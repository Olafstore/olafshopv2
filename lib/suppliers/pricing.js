// Gross margin, not markup. Excludes fees, taxes, refunds and operating costs.
// Integer satang arithmetic rounds the selling price UP to retain >=25% margin.
export function priceAt25PercentMargin(cost) {
  const value=String(cost);
  if(!/^\d{1,10}(\.\d{1,2})?$/.test(value))throw new Error('INVALID_SUPPLIER_COST');
  const [whole,fraction='']=value.split('.');
  const cents=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(cents<=0n)throw new Error('INVALID_SUPPLIER_COST');
  const selling=(cents*4n+2n)/3n;
  const money=n=>`${n/100n}.${String(n%100n).padStart(2,'0')}`;
  return {selling_price:money(selling),profit_amount:money(selling-cents),
    profit_percent:Number(((selling-cents)*100000000n/selling))/1000000};
}
