import { supabase } from "@/integrations/supabase/client";
import { 
  Reseller, 
  Consignment, 
  ConsignmentItem, 
  ConsignmentSettlement,
  ConsignmentStatus,
  SettlementStatus,
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
    if (!reseller.company_id) {
      throw new Error('company_id is required to create a reseller');
    }

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
      .from('consignacoes')
      .select(`
        *,
        reseller:resellers(*)
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (resellerId) {
      query = query.eq('reseller_id', resellerId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Consignment[];
  }

  static async getConsignment(id: string): Promise<{ 
    consignment: Consignment; 
    items: ConsignmentItem[];
    settlements: ConsignmentSettlement[];
  }> {
    const [consignmentRes, itemsRes, settlementsRes] = await Promise.all([
      supabase
        .from('consignacoes')
        .select(`
          *,
          reseller:resellers(*)
        `)
        .eq('id', id)
        .single(),
      supabase
        .from('consignment_items')
        .select(`
          *,
          product:products(name, sku, barcode)
        `)
        .eq('consignment_id', id),
      supabase
        .from('consignment_settlements')
        .select('*')
        .eq('consignment_id', id)
        .order('created_at', { ascending: false })
    ]);

    if (consignmentRes.error) throw consignmentRes.error;
    if (itemsRes.error) throw itemsRes.error;
    if (settlementsRes.error) throw settlementsRes.error;

    return {
      consignment: consignmentRes.data as Consignment,
      items: (itemsRes.data || []) as ConsignmentItem[],
      settlements: (settlementsRes.data || []) as ConsignmentSettlement[]
    };
  }

  static async createConsignment(
    consignment: Omit<Consignment, 'id' | 'created_at' | 'updated_at' | 'status'>,
    items: Array<{ product_id: string; sent_quantity: number; cost_price: number; suggested_price?: number }>
  ): Promise<Consignment> {
    const { reseller, ...consignmentData } = consignment as any;
    
    if (!consignmentData.company_id) {
      throw new Error('company_id is required to create a consignment');
    }

    // Use a transaction-like approach by checking errors carefully
    const { data: newConsignment, error: cError } = await supabase
      .from('consignacoes')
      .insert({ 
        ...consignmentData, 
        status: 'ativa',
        // Ensure required fields for the table are present based on migration
        commission_type: 'percentual', // Defaulting since it's required in schema but not in form
        commission_value: 0
      })
      .select()
      .single();

    if (cError) {
      console.error('Error creating consignment header:', cError);
      throw new Error(`Erro ao criar cabeçalho da consignação: ${cError.message}`);
    }

    const itemsToInsert = items.map(item => ({
      ...item,
      company_id: consignmentData.company_id,
      consignment_id: newConsignment.id,
      sold_quantity: 0,
      returned_quantity: 0,
      quantidade_extraviada: 0
    }));

    console.log('Inserting consignment items:', itemsToInsert);

    const { error: iError } = await supabase
      .from('consignment_items')
      .insert(itemsToInsert as any);

    if (iError) {
      console.error('Error creating consignment items:', iError);
      // Attempt to delete the header if items fail to maintain integrity
      await supabase.from('consignacoes').delete().eq('id', newConsignment.id);
      throw new Error(`Erro ao salvar itens da consignação: ${iError.message}`);
    }

    return newConsignment as Consignment;
  }

  static async registerSettlement(
    consignmentId: string,
    companyId: string,
    settlementData: {
      items_sold: Record<string, number>;
      items_returned: Record<string, number>;
      items_extraviado: Record<string, number>;
      extravio_notes: Record<string, string>;
      gross_amount: number;
      reseller_commission: number;
      net_receivable: number;
    }
  ): Promise<ConsignmentSettlement> {
    if (!companyId) {
      throw new Error('companyId is required to register a settlement');
    }

    const { data: settlement, error: sError } = await supabase
      .from('consignment_settlements')
      .insert({
        company_id: companyId,
        consignment_id: consignmentId,
        items_snapshot: {
          sold: settlementData.items_sold,
          returned: settlementData.items_returned,
          extraviado: settlementData.items_extraviado,
          notes: settlementData.extravio_notes
        },
      gross_amount: settlementData.gross_amount,
      reseller_commission: 0,
      net_receivable: settlementData.gross_amount,
        payment_status: 'pendente'
      } as any)
      .select()
      .single();

    if (sError) throw sError;

    const itemIds = Object.keys(settlementData.items_sold);
    
    for (const itemId of itemIds) {
      const sold = settlementData.items_sold[itemId] || 0;
      const returned = settlementData.items_returned[itemId] || 0;
      const extraviado = settlementData.items_extraviado[itemId] || 0;
      
      const { data: currentItem } = await supabase
        .from('consignment_items')
        .select('*')
        .eq('id', itemId)
        .single();
      
      if (currentItem) {
        const item = currentItem as any;
        await supabase
          .from('consignment_items')
          .update({
            sold_quantity: (item.sold_quantity || 0) + sold,
            returned_quantity: (item.returned_quantity || 0) + returned,
            quantidade_extraviada: (item.quantidade_extraviada || 0) + extraviado
          } as any)
          .eq('id', itemId);
      }
    }

    return settlement as unknown as ConsignmentSettlement;
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

  static async updateConsignmentStatus(id: string, status: ConsignmentStatus): Promise<void> {
    const { error } = await supabase
      .from('consignacoes')
      .update({ status } as any)
      .eq('id', id);
    
    if (error) throw error;
  }

  static async updateSettlementStatus(id: string, status: SettlementStatus): Promise<void> {
    const updateData: any = { payment_status: status };
    if (status === 'pago') {
      updateData.paid_at = new Date().toISOString();
    } else {
      updateData.paid_at = null;
    }

    const { error } = await supabase
      .from('consignment_settlements')
      .update(updateData)
      .eq('id', id);
    
    if (error) throw error;
  }

  static async deleteConsignment(id: string): Promise<void> {
    // Apagar primeiro os registros relacionados para evitar violação de FK
    const { error: sError } = await supabase
      .from('consignment_settlements')
      .delete()
      .eq('consignment_id', id);
    if (sError) throw sError;

    const { error: iError } = await supabase
      .from('consignment_items')
      .delete()
      .eq('consignment_id', id);
    if (iError) throw iError;

    const { error: cError } = await supabase
      .from('consignacoes')
      .delete()
      .eq('id', id);
    if (cError) throw cError;
  }

  static async updateConsignmentItems(
    consignmentId: string,
    companyId: string,
    items: Array<{ id?: string; product_id: string; sent_quantity: number; cost_price: number; suggested_price?: number }>
  ): Promise<void> {
    const { data: existingItems, error: fetchError } = await supabase
      .from('consignment_items')
      .select('id, sold_quantity, returned_quantity, quantidade_extraviada')
      .eq('consignment_id', consignmentId);

    if (fetchError) throw fetchError;

    const itemsToKeepIds = items.map(it => it.id).filter(Boolean) as string[];
    const itemsToDelete = existingItems.filter(ei => !itemsToKeepIds.includes(ei.id));

    // Validar remoções
    for (const item of itemsToDelete) {
      if ((item.sold_quantity || 0) > 0 || (item.returned_quantity || 0) > 0 || (item.quantidade_extraviada || 0) > 0) {
        throw new Error('Não é possível remover um item que já teve vendas, devoluções ou extravios registrados.');
      }
    }

    // Deletar itens removidos
    if (itemsToDelete.length > 0) {
      const { error: delError } = await supabase
        .from('consignment_items')
        .delete()
        .in('id', itemsToDelete.map(i => i.id));
      if (delError) throw delError;
    }

    // Upsert itens (novos e atualizados)
    const upsertData = items.map(item => {
      const existing = item.id ? existingItems.find(ei => ei.id === item.id) : null;
      
      return {
        ...(item.id ? { id: item.id } : {}),
        consignment_id: consignmentId,
        company_id: companyId,
        product_id: item.product_id,
        sent_quantity: item.sent_quantity,
        cost_price: item.cost_price,
        suggested_price: item.suggested_price || 0,
        sold_quantity: existing ? (existing.sold_quantity ?? 0) : 0,
        returned_quantity: existing ? (existing.returned_quantity ?? 0) : 0,
        quantidade_extraviada: existing ? (existing.quantidade_extraviada ?? 0) : 0
      };
    });

    const { error: upsertError } = await supabase
      .from('consignment_items')
      .upsert(upsertData as any);

    if (upsertError) throw upsertError;
  }
}
