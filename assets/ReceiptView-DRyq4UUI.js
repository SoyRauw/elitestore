import{E as e,n as t}from"./index-DZPGvOyU.js";var n={receipt:`_receipt_n5mgn_1`,brand:`_brand_n5mgn_14`,brandName:`_brandName_n5mgn_21`,brandSubtitle:`_brandSubtitle_n5mgn_28`,meta:`_meta_n5mgn_34`,metaRow:`_metaRow_n5mgn_38`,section:`_section_n5mgn_49`,sectionTitle:`_sectionTitle_n5mgn_55`,customerName:`_customerName_n5mgn_64`,customerMeta:`_customerMeta_n5mgn_69`,item:`_item_n5mgn_75`,itemMain:`_itemMain_n5mgn_87`,itemQty:`_itemQty_n5mgn_93`,itemName:`_itemName_n5mgn_98`,itemVariantLabel:`_itemVariantLabel_n5mgn_102`,itemPrice:`_itemPrice_n5mgn_108`,totals:`_totals_n5mgn_119`,totalRow:`_totalRow_n5mgn_125`,discountRow:`_discountRow_n5mgn_133`,couponName:`_couponName_n5mgn_138`,totalFinal:`_totalFinal_n5mgn_145`,paymentRow:`_paymentRow_n5mgn_155`,paymentRef:`_paymentRef_n5mgn_162`,totalPaidRow:`_totalPaidRow_n5mgn_169`,changeRow:`_changeRow_n5mgn_170`,notes:`_notes_n5mgn_183`,footer:`_footer_n5mgn_189`},r=e(),i={efectivo:`Efectivo`,pago_movil:`Pago Móvil`,zelle:`Zelle`,zinli:`Zinli`,binance:`Binance`,transferencia:`Transferencia`,punto:`Punto de Venta`,pendiente:`Pendiente`,multiple:`Múltiple`},a={retail:`Venta al detal`,wholesale:`Venta al mayor`};function o(e){return e?e.type===`reward`?e.coupon?.name:e.type===`customer`?e.coupon?.reward_coupons?.name:e.name||e.reward_coupons?.name||null:null}function s({movement:e,items:s,payments:c,customer:l,subtotal:u,discount:d,appliedCoupon:f,total:p,createdAt:m,className:h=``}){let g=m?new Date(m):new Date,_=(c||[]).reduce((e,t)=>e+(parseFloat(t.amount)||0),0),v=Math.max(0,_-p),y=e?.id?.slice(0,8)||`—`;return(0,r.jsxs)(`div`,{className:`${n.receipt} print-receipt ${h}`,children:[(0,r.jsxs)(`div`,{className:n.brand,children:[(0,r.jsx)(`div`,{className:n.brandName,children:`Elite Store`}),(0,r.jsx)(`div`,{className:n.brandSubtitle,children:`Recibo de venta`})]}),(0,r.jsxs)(`div`,{className:n.meta,children:[(0,r.jsxs)(`div`,{className:n.metaRow,children:[(0,r.jsx)(`span`,{children:`Recibo`}),(0,r.jsxs)(`strong`,{children:[`#`,y]})]}),(0,r.jsxs)(`div`,{className:n.metaRow,children:[(0,r.jsx)(`span`,{children:`Fecha`}),(0,r.jsx)(`strong`,{children:g.toLocaleString()})]}),e?.movement_type&&(0,r.jsxs)(`div`,{className:n.metaRow,children:[(0,r.jsx)(`span`,{children:`Tipo`}),(0,r.jsx)(`strong`,{children:e.movement_type.toUpperCase()})]}),e?.status&&(0,r.jsxs)(`div`,{className:n.metaRow,children:[(0,r.jsx)(`span`,{children:`Estado`}),(0,r.jsx)(`strong`,{children:e.status.toUpperCase()})]}),e?.sale_type&&(0,r.jsxs)(`div`,{className:n.metaRow,children:[(0,r.jsx)(`span`,{children:`Tipo`}),(0,r.jsx)(`strong`,{children:a[e.sale_type]||e.sale_type})]})]}),(l?.name||e?.customer_name)&&(0,r.jsxs)(`div`,{className:n.section,children:[(0,r.jsx)(`div`,{className:n.sectionTitle,children:`Cliente`}),(0,r.jsx)(`div`,{className:n.customerName,children:l?.name||e.customer_name}),(l?.id_number||e?.customer_id)&&(0,r.jsxs)(`div`,{className:n.customerMeta,children:[`Cédula: `,l?.id_number||`—`]}),(l?.phone||e?.customer_phone)&&(0,r.jsxs)(`div`,{className:n.customerMeta,children:[`Teléfono: `,l?.phone||e.customer_phone]})]}),(0,r.jsxs)(`div`,{className:n.section,children:[(0,r.jsx)(`div`,{className:n.sectionTitle,children:`Productos`}),s?.map((e,i)=>(0,r.jsxs)(`div`,{className:n.item,children:[(0,r.jsxs)(`div`,{className:n.itemMain,children:[(0,r.jsxs)(`span`,{className:n.itemQty,children:[e.quantity,`x`]}),(0,r.jsx)(`span`,{className:n.itemName,children:e.product?.name||e.products?.name})]}),(0,r.jsx)(`div`,{className:n.itemVariantLabel,children:t(e.variant||e.product_variants,e.product?.categories?.size_label||e.products?.categories?.size_label)}),(0,r.jsxs)(`div`,{className:n.itemPrice,children:[`$`,(e.price||e.unit_price||0).toFixed(2),` c/u`,(0,r.jsxs)(`strong`,{children:[`$`,((e.price||e.unit_price||0)*e.quantity).toFixed(2)]})]})]},i))]}),(0,r.jsxs)(`div`,{className:n.totals,children:[(0,r.jsxs)(`div`,{className:n.totalRow,children:[(0,r.jsx)(`span`,{children:`Subtotal`}),(0,r.jsxs)(`strong`,{children:[`$`,(u||0).toFixed(2)]})]}),(d||e?.discount_amount)>0&&(0,r.jsxs)(`div`,{className:`${n.totalRow} ${n.discountRow}`,children:[(0,r.jsxs)(`span`,{children:[`Descuento`,(o(f)||e?.customer_coupons?.reward_coupons?.name)&&(0,r.jsxs)(`span`,{className:n.couponName,children:[`(`,o(f)||e?.customer_coupons?.reward_coupons?.name,`)`]})]}),(0,r.jsxs)(`strong`,{children:[`-$`,(d||e?.discount_amount||0).toFixed(2)]})]}),(0,r.jsxs)(`div`,{className:n.totalFinal,children:[(0,r.jsx)(`span`,{children:`Total`}),(0,r.jsxs)(`strong`,{children:[`$`,(p||0).toFixed(2)]})]}),(e?.credit_amount||0)>0&&(0,r.jsxs)(`div`,{className:`${n.totalRow} ${n.discountRow}`,children:[(0,r.jsx)(`span`,{children:`Crédito usado`}),(0,r.jsxs)(`strong`,{children:[`-$`,(e.credit_amount||0).toFixed(2)]})]})]}),c&&c.length>0||(e?.credit_amount||0)>0&&(0,r.jsxs)(`div`,{className:n.section,children:[(0,r.jsx)(`div`,{className:n.sectionTitle,children:`Pagos`}),(e?.credit_amount||0)>0&&(0,r.jsxs)(`div`,{className:n.paymentRow,children:[(0,r.jsx)(`span`,{children:`Crédito en cuenta`}),(0,r.jsxs)(`strong`,{children:[`$`,(e.credit_amount||0).toFixed(2)]})]}),c.map((e,t)=>(0,r.jsxs)(`div`,{className:n.paymentRow,children:[(0,r.jsx)(`span`,{children:i[e.method]||e.method}),(0,r.jsxs)(`strong`,{children:[`$`,(parseFloat(e.amount)||0).toFixed(2)]}),e.reference&&(0,r.jsxs)(`div`,{className:n.paymentRef,children:[`Ref: `,e.reference]})]},t)),(0,r.jsxs)(`div`,{className:n.totalPaidRow,children:[(0,r.jsx)(`span`,{children:`Total pagado`}),(0,r.jsxs)(`strong`,{children:[`$`,_.toFixed(2)]})]}),v>0&&(0,r.jsxs)(`div`,{className:n.changeRow,children:[(0,r.jsx)(`span`,{children:`Vuelto`}),(0,r.jsxs)(`strong`,{children:[`$`,v.toFixed(2)]})]})]}),e?.notes&&(0,r.jsxs)(`div`,{className:n.section,children:[(0,r.jsx)(`div`,{className:n.sectionTitle,children:`Notas`}),(0,r.jsx)(`div`,{className:n.notes,children:e.notes})]}),(0,r.jsx)(`div`,{className:n.footer,children:`¡Gracias por su compra!`})]})}var c={efectivo:`Efectivo`,pago_movil:`Pago Móvil`,zelle:`Zelle`,zinli:`Zinli`,binance:`Binance`,transferencia:`Transferencia`,punto:`Punto de Venta`,pendiente:`Pendiente`,multiple:`Múltiple`};function l(e){if(!e)return`—`;let t=[];return e.color&&t.push(e.color),e.variant_name&&t.push(e.variant_name),e.size&&t.push(`Talla ${e.size}`),t.join(` / `)||`—`}function u(e){return`$${(parseFloat(e)||0).toFixed(2)}`}function d({movement:e,items:t,payments:n,customer:r,subtotal:i,discount:a,appliedCoupon:s,total:d,createdAt:f}){let p=f?new Date(f):new Date,m=e?.id?.slice(0,8)||`—`,h=(n||[]).reduce((e,t)=>e+(parseFloat(t.amount)||0),0),g=Math.max(0,h-d),_=r?.name||e?.customer_name||null,v=r?.id_number||null,y=r?.phone||e?.customer_phone||null,b=a||e?.discount_amount||0,x=e?.credit_amount||0,S=o(s)||e?.customer_coupons?.reward_coupons?.name,C=(t||[]).map(e=>{let t=e.product?.name||e.products?.name||`—`,n=e.variant||e.product_variants,r=e.price||e.unit_price||0,i=e.quantity||1;return`
      <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f0f0;">
        <div style="display:flex; gap:6px; font-weight:500; color:#1f2937;">
          <span style="font-weight:700; min-width:24px;">${i}x</span>
          <span>${t}</span>
        </div>
        <div style="font-size:12px; color:#6b7280; margin-top:3px; margin-left:30px;">${l(n)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; margin-left:30px; font-size:13px;">
          <span>${u(r)} c/u</span>
          <strong>${u(r*i)}</strong>
        </div>
      </div>
    `}).join(``),w=(n||[]).length>0||x>0?`
      ${x>0?`
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>Crédito en cuenta</span>
          <strong>${u(x)}</strong>
        </div>
      `:``}
      ${(n||[]).map(e=>`
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>${c[e.method]||e.method}</span>
          <strong>${u(e.amount)}</strong>
        </div>
        ${e.reference?`<div style="font-size:11px; color:#6b7280; margin-bottom:6px;">Ref: ${e.reference}</div>`:``}
      `).join(``)}
      <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #f0f0f0; font-size:13px;">
        <span>Total pagado</span>
        <strong>${u(h+x)}</strong>
      </div>
      ${g>0?`
        <div style="display:flex; justify-content:space-between; margin-top:6px; color:#166534; font-size:13px; background:#dcfce7; padding:6px 8px; border-radius:6px;">
          <span>Vuelto</span>
          <strong>${u(g)}</strong>
        </div>
      `:``}
    `:``,T=_?`
      <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
        <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Cliente</div>
        <div style="font-weight:600; color:#1f2937;">${_}</div>
        ${v?`<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${v}</div>`:``}
        ${y?`<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${y}</div>`:``}
      </div>
    `:``,E=e?.notes?`
      <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
        <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Notas</div>
        <div style="font-size:12px; color:#6b7280; white-space:pre-wrap;">${e.notes}</div>
      </div>
    `:``;return`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Recibo ${m}</title>
        <style>
          @page { size: portrait; margin: 10mm; }
          @media print {
            body { margin: 0; padding: 0; }
            .receipt { border: none; border-radius: 0; padding: 0; max-width: none; width: 100%; }
          }
          body {
            margin: 0;
            padding: 0;
            font-family: ui-monospace, Consolas, monospace;
            font-size: 14px;
            color: #1f2937;
            background: white;
          }
          .receipt {
            width: 100%;
            max-width: 100%;
            padding: 16px;
            box-sizing: border-box;
            border: 1px dashed #d1d5db;
            border-radius: 8px;
            background: white;
          }
          .brand { text-align: center; border-bottom: 1px dashed #d1d5db; padding-bottom: 12px; margin-bottom: 14px; }
          .brand-name { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
          .brand-sub { font-size: 12px; color: #6b7280; }
          .meta-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
          .meta-row span { color: #6b7280; }
          .section-title { font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 10px; }
          .total-box { display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; border-top: 2px dashed #d1d5db; padding-top: 14px; margin-top: 14px; }
          .footer { text-align: center; margin-top: 18px; padding-top: 14px; border-top: 1px dashed #d1d5db; font-size: 12px; color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="brand">
            <div class="brand-name">Elite Store</div>
            <div class="brand-sub">Recibo de venta</div>
          </div>
          <div>
            <div class="meta-row"><span>Recibo</span><strong>#${m}</strong></div>
            <div class="meta-row"><span>Fecha</span><strong>${p.toLocaleString()}</strong></div>
            ${e?.movement_type?`<div class="meta-row"><span>Tipo</span><strong>${e.movement_type.toUpperCase()}</strong></div>`:``}
            ${e?.status?`<div class="meta-row"><span>Estado</span><strong>${e.status.toUpperCase()}</strong></div>`:``}
          </div>
          ${T}
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Productos</div>
            ${C}
          </div>
          <div>
            <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span>Subtotal</span>
              <span>${u(i||d)}</span>
            </div>
            ${b>0?`
              <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#16a34a;">
                <span>Descuento ${S?`(${S})`:``}</span>
                <span>-${u(b)}</span>
              </div>
            `:``}
            ${x>0?`
              <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#166534;">
                <span>Crédito usado</span>
                <span>-${u(x)}</span>
              </div>
            `:``}
            <div class="total-box">
              <span>Total</span>
              <span>${u(d)}</span>
            </div>
          </div>
          ${n||x>0?`<div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;"><div class="section-title">Pagos</div>${w}</div>`:``}
          ${E}
          <div class="footer">¡Gracias por su compra!</div>
        </div>
      </body>
    </html>
  `}function f(e){let t=document.createElement(`iframe`);t.style.position=`fixed`,t.style.top=`-9999px`,t.style.left=`-9999px`,t.style.width=`100%`,t.style.height=`0`,t.style.border=`none`,t.style.opacity=`0`,t.style.pointerEvents=`none`,document.body.appendChild(t);let n=t.contentWindow.document;n.open(),n.write(d(e)),n.close();let r=()=>{t.contentWindow.focus(),t.contentWindow.print()};t.contentWindow.document.readyState===`complete`?r():t.onload=r,setTimeout(()=>{document.body.contains(t)&&document.body.removeChild(t)},6e4)}export{f as n,s as t};