-- Additive migration: pending/unpaid supplier cancellation only.
begin;
create or replace function public.admin_cancel_pending_supplier_order(p_order_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare s public.supplier_checkouts%rowtype; o public.orders%rowtype;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and role='admin' and status='active') then
  raise exception 'ADMIN_REQUIRED';
 end if;
 -- Match server_begin_supplier_fulfillment: order first, then checkout.
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'ORDER_NOT_FOUND'; end if;
 select * into s from public.supplier_checkouts where order_id=p_order_id for update;
 if not found then raise exception 'SUPPLIER_ORDER_NOT_FOUND'; end if;
 if o.status='cancelled' then return jsonb_build_object('id',o.id,'status',o.status,'alreadyCancelled',true); end if;
 if o.payment_status='verified' or coalesce(o.points_redeemed_amount,0)>0
   or o.status not in ('awaiting_payment','waiting_admin','expired')
   or s.attempts>0 or s.state<>'pending' or s.provider_order_no is not null then
  raise exception 'SUPPLIER_REFUND_REVIEW_REQUIRED';
 end if;
 -- Preserve payload, amounts, payment status and supplier evidence.
 -- Existing reservation queries exclude orders with cancelled status.
 update public.orders set status='cancelled' where id=o.id;
 return jsonb_build_object('id',o.id,'status','cancelled');
end $$;
revoke all on function public.admin_cancel_pending_supplier_order(uuid) from public,anon;
grant execute on function public.admin_cancel_pending_supplier_order(uuid) to authenticated;
commit;
