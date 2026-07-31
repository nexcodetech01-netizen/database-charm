import {
  BookOpen,
  Cake,
  CalendarClock,
  CheckCheck,
  CreditCard,
  FileText,
  Gift,
  HandCoins,
  Link2,
  MessageSquare,
  Package,
  PartyPopper,
  QrCode,
  Receipt,
  Repeat,
  Sparkles,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type {
  AutomationAction,
  AutomationTrigger,
  QuickActionId,
  TemplateCategory,
  TimelineEventKind,
} from "./types";

export const QUICK_ACTION_ICON: Record<QuickActionId, LucideIcon> = {
  quote: FileText,
  order: Package,
  invoice: Receipt,
  charge: Wallet,
  pix: QrCode,
  bella_pay_link: CreditCard,
  receipt: HandCoins,
  catalog: BookOpen,
  pdf: FileText,
  tracking: Truck,
};

export const TEMPLATE_CATEGORY_ICON: Record<TemplateCategory, LucideIcon> = {
  welcome: Sparkles,
  order: Package,
  quote: FileText,
  charge: Wallet,
  post_sale: MessageSquare,
  reminder: CalendarClock,
  birthday: Cake,
};

export const AUTOMATION_TRIGGER_ICON: Record<AutomationTrigger, LucideIcon> = {
  after_sale: Receipt,
  after_quote: FileText,
  after_charge: Wallet,
  after_payment: PartyPopper,
};

export const AUTOMATION_ACTION_ICON: Record<AutomationAction, LucideIcon> = {
  send_receipt: HandCoins,
  send_pdf: FileText,
  send_pix: QrCode,
  send_thanks: Gift,
};

export const TIMELINE_KIND_ICON: Record<TimelineEventKind, LucideIcon> = {
  order_sent: Package,
  payment_received: HandCoins,
  pdf_sent: FileText,
  message_read: CheckCheck,
  charge_sent: Wallet,
  pix_paid: QrCode,
};

export const AUTOMATION_LINK_ICON: LucideIcon = Repeat;
export const AUTOMATION_ANY_ICON: LucideIcon = Link2;
