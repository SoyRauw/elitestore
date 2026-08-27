import{E as e,S as t,n}from"./index-D_VvRLoU.js";var r=t(`printer`,[[`path`,{d:`M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2`,key:`143wyd`}],[`path`,{d:`M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6`,key:`1itne7`}],[`rect`,{x:`6`,y:`14`,width:`12`,height:`8`,rx:`1`,key:`1ue0tg`}]]),i={receipt:`_receipt_n5mgn_1`,brand:`_brand_n5mgn_14`,brandName:`_brandName_n5mgn_21`,brandSubtitle:`_brandSubtitle_n5mgn_28`,meta:`_meta_n5mgn_34`,metaRow:`_metaRow_n5mgn_38`,section:`_section_n5mgn_49`,sectionTitle:`_sectionTitle_n5mgn_55`,customerName:`_customerName_n5mgn_64`,customerMeta:`_customerMeta_n5mgn_69`,item:`_item_n5mgn_75`,itemMain:`_itemMain_n5mgn_87`,itemQty:`_itemQty_n5mgn_93`,itemName:`_itemName_n5mgn_98`,itemVariantLabel:`_itemVariantLabel_n5mgn_102`,itemPrice:`_itemPrice_n5mgn_108`,totals:`_totals_n5mgn_119`,totalRow:`_totalRow_n5mgn_125`,discountRow:`_discountRow_n5mgn_133`,couponName:`_couponName_n5mgn_138`,totalFinal:`_totalFinal_n5mgn_145`,paymentRow:`_paymentRow_n5mgn_155`,paymentRef:`_paymentRef_n5mgn_162`,totalPaidRow:`_totalPaidRow_n5mgn_169`,changeRow:`_changeRow_n5mgn_170`,notes:`_notes_n5mgn_183`,footer:`_footer_n5mgn_189`},a=e(),o={efectivo:`Efectivo`,pago_movil:`Pago Móvil`,zelle:`Zelle`,zinli:`Zinli`,binance:`Binance`,transferencia:`Transferencia`,punto:`Punto de Venta`,pendiente:`Pendiente`,multiple:`Múltiple`},s={retail:`Venta al detal`,wholesale:`Venta al mayor`};function c(e){return e?e.type===`reward`?e.coupon?.name:e.type===`customer`?e.coupon?.reward_coupons?.name:e.name||e.reward_coupons?.name||null:null}function l({movement:e,items:t,payments:r,customer:l,subtotal:u,discount:d,appliedCoupon:f,total:p,createdAt:m,className:h=``}){let g=m?new Date(m):new Date,_=(r||[]).reduce((e,t)=>e+(parseFloat(t.amount)||0),0),v=Math.max(0,_-p),y=e?.id?.slice(0,8)||`—`;return(0,a.jsxs)(`div`,{className:`${i.receipt} print-receipt ${h}`,children:[(0,a.jsxs)(`div`,{className:i.brand,children:[(0,a.jsx)(`div`,{className:i.brandName,children:`Elite Store`}),(0,a.jsx)(`div`,{className:i.brandSubtitle,children:`Recibo de venta`})]}),(0,a.jsxs)(`div`,{className:i.meta,children:[(0,a.jsxs)(`div`,{className:i.metaRow,children:[(0,a.jsx)(`span`,{children:`Recibo`}),(0,a.jsxs)(`strong`,{children:[`#`,y]})]}),(0,a.jsxs)(`div`,{className:i.metaRow,children:[(0,a.jsx)(`span`,{children:`Fecha`}),(0,a.jsx)(`strong`,{children:g.toLocaleString()})]}),e?.movement_type&&(0,a.jsxs)(`div`,{className:i.metaRow,children:[(0,a.jsx)(`span`,{children:`Tipo`}),(0,a.jsx)(`strong`,{children:e.movement_type.toUpperCase()})]}),e?.status&&(0,a.jsxs)(`div`,{className:i.metaRow,children:[(0,a.jsx)(`span`,{children:`Estado`}),(0,a.jsx)(`strong`,{children:e.status.toUpperCase()})]}),e?.sale_type&&(0,a.jsxs)(`div`,{className:i.metaRow,children:[(0,a.jsx)(`span`,{children:`Tipo`}),(0,a.jsx)(`strong`,{children:s[e.sale_type]||e.sale_type})]})]}),(l?.name||e?.customer_name)&&(0,a.jsxs)(`div`,{className:i.section,children:[(0,a.jsx)(`div`,{className:i.sectionTitle,children:`Cliente`}),(0,a.jsx)(`div`,{className:i.customerName,children:l?.name||e.customer_name}),(l?.id_number||e?.customer_id)&&(0,a.jsxs)(`div`,{className:i.customerMeta,children:[`Cédula: `,l?.id_number||`—`]}),(l?.phone||e?.customer_phone)&&(0,a.jsxs)(`div`,{className:i.customerMeta,children:[`Teléfono: `,l?.phone||e.customer_phone]})]}),(0,a.jsxs)(`div`,{className:i.section,children:[(0,a.jsx)(`div`,{className:i.sectionTitle,children:`Productos`}),t?.map((e,t)=>(0,a.jsxs)(`div`,{className:i.item,children:[(0,a.jsxs)(`div`,{className:i.itemMain,children:[(0,a.jsxs)(`span`,{className:i.itemQty,children:[e.quantity,`x`]}),(0,a.jsx)(`span`,{className:i.itemName,children:e.product?.name||e.products?.name})]}),(0,a.jsx)(`div`,{className:i.itemVariantLabel,children:n(e.variant||e.product_variants,e.product?.categories?.size_label||e.products?.categories?.size_label)}),(0,a.jsxs)(`div`,{className:i.itemPrice,children:[`$`,(e.price||e.unit_price||0).toFixed(2),` c/u`,(0,a.jsxs)(`strong`,{children:[`$`,((e.price||e.unit_price||0)*e.quantity).toFixed(2)]})]})]},t))]}),(0,a.jsxs)(`div`,{className:i.totals,children:[(0,a.jsxs)(`div`,{className:i.totalRow,children:[(0,a.jsx)(`span`,{children:`Subtotal`}),(0,a.jsxs)(`strong`,{children:[`$`,(u||0).toFixed(2)]})]}),(d||e?.discount_amount)>0&&(0,a.jsxs)(`div`,{className:`${i.totalRow} ${i.discountRow}`,children:[(0,a.jsxs)(`span`,{children:[`Descuento`,(c(f)||e?.customer_coupons?.reward_coupons?.name)&&(0,a.jsxs)(`span`,{className:i.couponName,children:[`(`,c(f)||e?.customer_coupons?.reward_coupons?.name,`)`]})]}),(0,a.jsxs)(`strong`,{children:[`-$`,(d||e?.discount_amount||0).toFixed(2)]})]}),(0,a.jsxs)(`div`,{className:i.totalFinal,children:[(0,a.jsx)(`span`,{children:`Total`}),(0,a.jsxs)(`strong`,{children:[`$`,(p||0).toFixed(2)]})]})]}),r&&r.length>0&&(0,a.jsxs)(`div`,{className:i.section,children:[(0,a.jsx)(`div`,{className:i.sectionTitle,children:`Pagos`}),r.map((e,t)=>(0,a.jsxs)(`div`,{className:i.paymentRow,children:[(0,a.jsx)(`span`,{children:o[e.method]||e.method}),(0,a.jsxs)(`strong`,{children:[`$`,(parseFloat(e.amount)||0).toFixed(2)]}),e.reference&&(0,a.jsxs)(`div`,{className:i.paymentRef,children:[`Ref: `,e.reference]})]},t)),(0,a.jsxs)(`div`,{className:i.totalPaidRow,children:[(0,a.jsx)(`span`,{children:`Total pagado`}),(0,a.jsxs)(`strong`,{children:[`$`,_.toFixed(2)]})]}),v>0&&(0,a.jsxs)(`div`,{className:i.changeRow,children:[(0,a.jsx)(`span`,{children:`Vuelto`}),(0,a.jsxs)(`strong`,{children:[`$`,v.toFixed(2)]})]})]}),e?.notes&&(0,a.jsxs)(`div`,{className:i.section,children:[(0,a.jsx)(`div`,{className:i.sectionTitle,children:`Notas`}),(0,a.jsx)(`div`,{className:i.notes,children:e.notes})]}),(0,a.jsx)(`div`,{className:i.footer,children:`¡Gracias por su compra!`})]})}var u={efectivo:`Efectivo`,pago_movil:`Pago Móvil`,zelle:`Zelle`,zinli:`Zinli`,binance:`Binance`,transferencia:`Transferencia`,punto:`Punto de Venta`,pendiente:`Pendiente`,multiple:`Múltiple`};function d(e){if(!e)return`—`;let t=[];return e.color&&t.push(e.color),e.variant_name&&t.push(e.variant_name),e.size&&t.push(`Talla ${e.size}`),t.join(` / `)||`—`}function f(e){return`$${(parseFloat(e)||0).toFixed(2)}`}function p({movement:e,items:t,payments:n,customer:r,subtotal:i,discount:a,appliedCoupon:o,total:s,createdAt:l}){let p=l?new Date(l):new Date,m=e?.id?.slice(0,8)||`—`,h=(n||[]).reduce((e,t)=>e+(parseFloat(t.amount)||0),0),g=Math.max(0,h-s),_=r?.name||e?.customer_name||null,v=r?.id_number||null,y=r?.phone||e?.customer_phone||null,b=a||e?.discount_amount||0,x=c(o)||e?.customer_coupons?.reward_coupons?.name,S=(t||[]).map(e=>{let t=e.product?.name||e.products?.name||`—`,n=e.variant||e.product_variants,r=e.price||e.unit_price||0,i=e.quantity||1;return`
      <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f0f0;">
        <div style="display:flex; gap:6px; font-weight:500; color:#1f2937;">
          <span style="font-weight:700; min-width:24px;">${i}x</span>
          <span>${t}</span>
        </div>
        <div style="font-size:12px; color:#6b7280; margin-top:3px; margin-left:30px;">${d(n)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; margin-left:30px; font-size:13px;">
          <span>${f(r)} c/u</span>
          <strong>${f(r*i)}</strong>
        </div>
      </div>
    `}).join(``),C=(n||[]).length>0?(n||[]).map(e=>`
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>${u[e.method]||e.method}</span>
          <strong>${f(e.amount)}</strong>
        </div>
        ${e.reference?`<div style="font-size:11px; color:#6b7280; margin-bottom:6px;">Ref: ${e.reference}</div>`:``}
      `).join(``)+`
        <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #f0f0f0; font-size:13px;">
          <span>Total pagado</span>
          <strong>${f(h)}</strong>
        </div>
        ${g>0?`
          <div style="display:flex; justify-content:space-between; margin-top:6px; color:#166534; font-size:13px; background:#dcfce7; padding:6px 8px; border-radius:6px;">
            <span>Vuelto</span>
            <strong>${f(g)}</strong>
          </div>
        `:``}
      `:``,w=_?`
      <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
        <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Cliente</div>
        <div style="font-weight:600; color:#1f2937;">${_}</div>
        ${v?`<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${v}</div>`:``}
        ${y?`<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${y}</div>`:``}
      </div>
    `:``,T=e?.notes?`
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
          ${w}
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Productos</div>
            ${S}
          </div>
          <div>
            <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span>Subtotal</span>
              <span>${f(i||s)}</span>
            </div>
            ${b>0?`
              <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#16a34a;">
                <span>Descuento ${x?`(${x})`:``}</span>
                <span>-${f(b)}</span>
              </div>
            `:``}
            <div class="total-box">
              <span>Total</span>
              <span>${f(s)}</span>
            </div>
          </div>
          ${n?`<div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;"><div class="section-title">Pagos</div>${C}</div>`:``}
          ${T}
          <div class="footer">¡Gracias por su compra!</div>
        </div>
      </body>
    </html>
  `}function m(e){let t=document.createElement(`iframe`);t.style.position=`fixed`,t.style.top=`-9999px`,t.style.left=`-9999px`,t.style.width=`100%`,t.style.height=`0`,t.style.border=`none`,t.style.opacity=`0`,t.style.pointerEvents=`none`,document.body.appendChild(t);let n=t.contentWindow.document;n.open(),n.write(p(e)),n.close();let r=()=>{t.contentWindow.focus(),t.contentWindow.print()};t.contentWindow.document.readyState===`complete`?r():t.onload=r,setTimeout(()=>{document.body.contains(t)&&document.body.removeChild(t)},6e4)}export{m as n,r,l as t};