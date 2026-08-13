import { supabase } from "@/integrations/supabase/client";
import { 
  Reseller, 
  Consignment, 
  ConsignmentItem, 
  ConsignmentSettlement,
} from "../types";

export class ConsignmentService {
  static async listResellers(companyId: string): Promise<Reseller[]> {
    const { data, error } = await supabase
      .from('resellers')
      .select('*')
      .eq('company_id', companyId)
      .order('name');
    
    if (error) throw error;
    return (data || []) as Reseller[];
  }

  static async createReseller(reseller: Omit<Reseller, 'id' | 'created_at' | 'updated_at'>): Promise<Reseller> {
    const { data, error } = await supabase
      .from('resellers')
      .insert(reseller)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async listConsignments(companyId: string, resellerId?: string): Promise<Consignment[]> {
    let query = supabase
      .from('consignments')
      .select('*, reseller:resellers(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (resellerId) {
      query = query.eq('reseller_id', resellerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Consignment[];
  }

  static async getConsignment(id: string): Promise<{ consignment: Consignment; items: ConsignmentItem[] }> {
    const [consignmentRes, itemsRes] = await Promise.all([
      supabase
        .from('consignments')
        .select('*, reseller:resellers(*)')
        .eq('id', id)
        .single(),
      supabase
        .from('consignment_items')
        .select('*, product:products(name, sku, barcode)')
        .eq('consignment_id', id)
    ]);

    if (consignmentRes.error) throw consignmentRes.error;
    if (itemsRes.error) throw itemsRes.error;

    return {
      consignment: consignmentRes.data as Consignment,
      items: (itemsRes.data || []) as ConsignmentItem[]
    };
  }

  static async createConsignment(
    consignment: Omit<Consignment, 'id' | 'created_at' | 'updated_at' | 'status'>,
    items: Array<{ product_id: string; sent_quantity: number; cost_price: number; suggested_price?: number }>
  ): Promise<Consignment> {
    const { reseller, ...consignmentData } = consignment as any;
    const { data: newConsignment, error: cError } = await supabase
      .from('consignments')
      .insert({ ...consignmentData, status: 'ativa' })
      .select()
      .single();

    if (cError) throw cError;

    const itemsToInsert = items.map(item => ({
      ...item,
      company_id: consignment.company_id,
      consignment_id: (newConsignment as any).id
    }));

    const { error: iError } = await supabase
      .from('consignment_items')
      .insert(itemsToInsert);

    if (iError) throw iError;

    return newConsignment as Consignment;
  }

  static async registerSettlement(
    consignmentId: string,
    companyId: string,
    settlementData: {
      items_sold: Record<string, number>;
      items_returned: Record<string, number>;
      gross_amount: number;
      reseller_commission: number;
      net_receivable: number;
    }
  ): Promise<ConsignmentSettlement> {
    const { data: settlement, error: sError } = await supabase
      .from('consignment_settlements')
      .insert({
        company_id: companyId,
        consignment_id: consignmentId,
        items_snapshot: {
          sold: settlementData.items_sold,
          returned: settlementData.items_returned
        },
        gross_amount: settlementData.gross_amount,
        reseller_commission: settlementData.reseller_commission,
        net_receivable: settlementData.net_receivable,
        payment_status: 'pendente'
      })
      .select()
      .single();

    if (sError) throw sError;

    // Update items quantities
    const itemIds = Object.keys(settlementData.items_sold);
    
    // We do this in a loop for simplicity, but ideally we'd use an RPC or multiple updates
    for (const itemId of itemIds) {
      const sold = settlementData.items_sold[itemId] || 0;
      const returned = settlementData.items_returned[itemId] || 0;
      
      const { data: currentItem } = await supabase
        .from('consignment_items')
        .select('sold_quantity, returned_quantity')
        .eq('id', itemId)
        .single();
      
      if (currentItem) {
        await supabase
          .from('consignment_items')
          .update({
            sold_quantity: (currentItem as any).sold_quantity + sold,
            returned_quantity: (currentItem as any).returned_quantity + returned
          })
          .eq('id', itemId);
      }
    }

    return settlement as ConsignmentSettlement;
  }

  static async listSettlements(consignmentId: string): Promise<ConsignmentSettlement[]> {
    const { data, error } = await supabase
      .from('consignment_settlements')
      .select('*')
      .eq('consignment_id', consignmentId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as ConsignmentSettlement[];
  }
}
