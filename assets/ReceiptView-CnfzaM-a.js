import{D as e,r as t}from"./index-CG9LyB5m.js";import{i as n}from"./bills-Cy-RVKjo.js";var r={receipt:`_receipt_8kpej_1`,brand:`_brand_8kpej_14`,brandName:`_brandName_8kpej_21`,brandSubtitle:`_brandSubtitle_8kpej_28`,meta:`_meta_8kpej_34`,metaRow:`_metaRow_8kpej_38`,section:`_section_8kpej_49`,sectionTitle:`_sectionTitle_8kpej_55`,customerName:`_customerName_8kpej_64`,customerMeta:`_customerMeta_8kpej_69`,item:`_item_8kpej_75`,itemMain:`_itemMain_8kpej_87`,itemQty:`_itemQty_8kpej_93`,itemName:`_itemName_8kpej_98`,itemVariantLabel:`_itemVariantLabel_8kpej_102`,itemPrice:`_itemPrice_8kpej_108`,totals:`_totals_8kpej_119`,totalRow:`_totalRow_8kpej_125`,discountRow:`_discountRow_8kpej_133`,couponName:`_couponName_8kpej_138`,totalFinal:`_totalFinal_8kpej_145`,paymentRow:`_paymentRow_8kpej_155`,paymentRef:`_paymentRef_8kpej_162`,paymentBs:`_paymentBs_8kpej_169`,totalPaidRow:`_totalPaidRow_8kpej_174`,changeRow:`_changeRow_8kpej_175`,notes:`_notes_8kpej_188`,footer:`_footer_8kpej_194`},i=e(),a={efectivo:`Efectivo`,pago_movil:`Pago Móvil`,zelle:`Zelle`,zinli:`Zinli`,rapikom:`Rapikom`,efectivo_bs:`Efectivo Bs`,binance:`Binance`,transferencia:`Transferencia`,punto:`Punto de Venta`,pendiente:`Pendiente`,credito:`Crédito en cuenta`,giftcard:`Giftcard`,multiple:`Múltiple`},o={retail:`Venta al detal`,wholesale:`Venta al mayor`};function s(e){return e?e.type===`reward`?e.coupon?.name:e.type===`customer`?e.coupon?.reward_coupons?.name:e.name||e.reward_coupons?.name||null:null}function c({movement:e,items:c,payments:l,customer:u,subtotal:d,discount:f,appliedCoupon:p,total:m,createdAt:h,className:g=``}){let _=h?new Date(h):new Date,v=(l||[]).reduce((e,t)=>e+(parseFloat(t.amount)||0),0),y=Math.max(0,v-m),b=e?.id?.slice(0,8)||`—`;return(0,i.jsxs)(`div`,{className:`${r.receipt} print-receipt ${g}`,children:[(0,i.jsxs)(`div`,{className:r.brand,children:[(0,i.jsx)(`div`,{className:r.brandName,children:`Elite Store`}),(0,i.jsx)(`div`,{className:r.brandSubtitle,children:`Recibo de venta`})]}),(0,i.jsxs)(`div`,{className:r.meta,children:[(0,i.jsxs)(`div`,{className:r.metaRow,children:[(0,i.jsx)(`span`,{children:`Recibo`}),(0,i.jsxs)(`strong`,{children:[`#`,b]})]}),(0,i.jsxs)(`div`,{className:r.metaRow,children:[(0,i.jsx)(`span`,{children:`Fecha`}),(0,i.jsx)(`strong`,{children:_.toLocaleString()})]}),e?.movement_type&&(0,i.jsxs)(`div`,{className:r.metaRow,children:[(0,i.jsx)(`span`,{children:`Tipo`}),(0,i.jsx)(`strong`,{children:e.movement_type.toUpperCase()})]}),e?.status&&(0,i.jsxs)(`div`,{className:r.metaRow,children:[(0,i.jsx)(`span`,{children:`Estado`}),(0,i.jsx)(`strong`,{children:e.status.toUpperCase()})]}),e?.sale_type&&(0,i.jsxs)(`div`,{className:r.metaRow,children:[(0,i.jsx)(`span`,{children:`Tipo`}),(0,i.jsx)(`strong`,{children:o[e.sale_type]||e.sale_type})]})]}),(u?.name||e?.customer_name)&&(0,i.jsxs)(`div`,{className:r.section,children:[(0,i.jsx)(`div`,{className:r.sectionTitle,children:`Cliente`}),(0,i.jsx)(`div`,{className:r.customerName,children:u?.name||e.customer_name}),(u?.id_number||e?.customer_id)&&(0,i.jsxs)(`div`,{className:r.customerMeta,children:[`Cédula: `,u?.id_number||`—`]}),(u?.phone||e?.customer_phone)&&(0,i.jsxs)(`div`,{className:r.customerMeta,children:[`Teléfono: `,u?.phone||e.customer_phone]})]}),(0,i.jsxs)(`div`,{className:r.section,children:[(0,i.jsx)(`div`,{className:r.sectionTitle,children:`Productos`}),c?.map((e,n)=>(0,i.jsxs)(`div`,{className:r.item,children:[(0,i.jsxs)(`div`,{className:r.itemMain,children:[(0,i.jsxs)(`span`,{className:r.itemQty,children:[e.quantity,`x`]}),(0,i.jsx)(`span`,{className:r.itemName,children:e.product?.name||e.products?.name})]}),(0,i.jsx)(`div`,{className:r.itemVariantLabel,children:t(e.variant||e.product_variants,e.product?.categories?.size_label||e.products?.categories?.size_label)}),(0,i.jsxs)(`div`,{className:r.itemPrice,children:[`$`,(e.price||e.unit_price||0).toFixed(2),` c/u`,(0,i.jsxs)(`strong`,{children:[`$`,((e.price||e.unit_price||0)*e.quantity).toFixed(2)]})]})]},n))]}),(0,i.jsxs)(`div`,{className:r.totals,children:[(0,i.jsxs)(`div`,{className:r.totalRow,children:[(0,i.jsx)(`span`,{children:`Subtotal`}),(0,i.jsxs)(`strong`,{children:[`$`,(d||0).toFixed(2)]})]}),(f||e?.discount_amount)>0&&(0,i.jsxs)(`div`,{className:`${r.totalRow} ${r.discountRow}`,children:[(0,i.jsxs)(`span`,{children:[`Descuento`,(s(p)||e?.customer_coupons?.reward_coupons?.name)&&(0,i.jsxs)(`span`,{className:r.couponName,children:[`(`,s(p)||e?.customer_coupons?.reward_coupons?.name,`)`]})]}),(0,i.jsxs)(`strong`,{children:[`-$`,(f||e?.discount_amount||0).toFixed(2)]})]}),(0,i.jsxs)(`div`,{className:r.totalFinal,children:[(0,i.jsx)(`span`,{children:`Total`}),(0,i.jsxs)(`strong`,{children:[`$`,(m||0).toFixed(2)]})]}),(e?.credit_amount||0)>0&&(0,i.jsxs)(`div`,{className:`${r.totalRow} ${r.discountRow}`,children:[(0,i.jsx)(`span`,{children:`Crédito usado`}),(0,i.jsxs)(`strong`,{children:[`-$`,(e.credit_amount||0).toFixed(2)]})]})]}),l&&l.length>0||(e?.credit_amount||0)>0&&(0,i.jsxs)(`div`,{className:r.section,children:[(0,i.jsx)(`div`,{className:r.sectionTitle,children:`Pagos`}),(e?.credit_amount||0)>0&&(0,i.jsxs)(`div`,{className:r.paymentRow,children:[(0,i.jsx)(`span`,{children:`Crédito en cuenta`}),(0,i.jsxs)(`strong`,{children:[`$`,(e.credit_amount||0).toFixed(2)]})]}),l.map((e,t)=>(0,i.jsxs)(`div`,{className:r.paymentRow,children:[(0,i.jsxs)(`span`,{children:[a[e.method]||e.method,e.bs&&(0,i.jsxs)(`span`,{className:r.paymentBs,children:[` (Bs `,Math.round(parseFloat(e.bs)).toLocaleString(`es-VE`),`)`]})]}),(0,i.jsxs)(`strong`,{children:[`$`,(parseFloat(e.amount)||0).toFixed(2)]}),e.reference&&(0,i.jsxs)(`div`,{className:r.paymentRef,children:[`Ref: `,e.reference]})]},t)),(0,i.jsxs)(`div`,{className:r.totalPaidRow,children:[(0,i.jsx)(`span`,{children:`Total pagado`}),(0,i.jsxs)(`strong`,{children:[`$`,v.toFixed(2)]})]}),y>0&&(0,i.jsxs)(`div`,{className:r.changeRow,children:[(0,i.jsx)(`span`,{children:`Vuelto`}),(0,i.jsxs)(`strong`,{children:[`$`,y.toFixed(2)]}),l&&(()=>{let e=l.find(e=>e.method===`efectivo`)||{},t=[];return e.changeBills&&t.push(n(e.changeBills)),parseFloat(e.vueltoBs)>0&&t.push(`Bs ${Math.round(parseFloat(e.vueltoBs)).toLocaleString(`es-VE`)} efectivo`),parseFloat(e.vueltoPm)>0&&t.push(`$${parseFloat(e.vueltoPm).toFixed(2)} pago móvil${e.vueltoPmReference?` (Ref: ${e.vueltoPmReference})`:``}`),parseFloat(e.vueltoCredito)>0&&t.push(`$${parseFloat(e.vueltoCredito).toFixed(2)} crédito en tienda`),t.length>0?(0,i.jsx)(`div`,{className:r.paymentRef,style:{width:`100%`},children:t.join(` · `)}):null})()]})]}),e?.notes&&(0,i.jsxs)(`div`,{className:r.section,children:[(0,i.jsx)(`div`,{className:r.sectionTitle,children:`Notas`}),(0,i.jsx)(`div`,{className:r.notes,children:e.notes})]}),(0,i.jsx)(`div`,{className:r.footer,children:`¡Gracias por su compra!`})]})}var l={efectivo:`Efectivo`,pago_movil:`Pago Móvil`,zelle:`Zelle`,zinli:`Zinli`,rapikom:`Rapikom`,efectivo_bs:`Efectivo Bs`,binance:`Binance`,transferencia:`Transferencia`,punto:`Punto de Venta`,pendiente:`Pendiente`,credito:`Crédito en cuenta`,giftcard:`Giftcard`,multiple:`Múltiple`};function u(e){if(!e)return`—`;let t=[];return e.color&&t.push(e.color),e.variant_name&&t.push(e.variant_name),e.size&&t.push(`Talla ${e.size}`),t.join(` / `)||`—`}function d(e){return`$${(parseFloat(e)||0).toFixed(2)}`}function f({movement:e,items:t,payments:r,customer:i,subtotal:a,discount:o,appliedCoupon:c,total:f,createdAt:p}){let m=p?new Date(p):new Date,h=e?.id?.slice(0,8)||`—`,g=(r||[]).reduce((e,t)=>e+(parseFloat(t.amount)||0),0),_=Math.max(0,g-f),v=i?.name||e?.customer_name||null,y=i?.id_number||null,b=i?.phone||e?.customer_phone||null,x=o||e?.discount_amount||0,S=e?.credit_amount||0,C=s(c)||e?.customer_coupons?.reward_coupons?.name,w=(t||[]).map(e=>{let t=e.product?.name||e.products?.name||`—`,n=e.variant||e.product_variants,r=e.price||e.unit_price||0,i=e.quantity||1;return`
      <div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #f0f0f0;">
        <div style="display:flex; gap:6px; font-weight:500; color:#1f2937;">
          <span style="font-weight:700; min-width:24px;">${i}x</span>
          <span>${t}</span>
        </div>
        <div style="font-size:12px; color:#6b7280; margin-top:3px; margin-left:30px;">${u(n)}</div>
        <div style="display:flex; justify-content:space-between; margin-top:4px; margin-left:30px; font-size:13px;">
          <span>${d(r)} c/u</span>
          <strong>${d(r*i)}</strong>
        </div>
      </div>
    `}).join(``),T=(r||[]).length>0||S>0?`
      ${S>0?`
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>Crédito en cuenta</span>
          <strong>${d(S)}</strong>
        </div>
      `:``}
      ${(r||[]).map(e=>`
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
          <span>${l[e.method]||e.method}${e.bs?` (Bs ${Math.round(parseFloat(e.bs)).toLocaleString(`es-VE`)})`:``}</span>
          <strong>${d(e.amount)}</strong>
        </div>
        ${e.reference?`<div style="font-size:11px; color:#6b7280; margin-bottom:6px;">Ref: ${e.reference}</div>`:``}
      `).join(``)}
      <div style="display:flex; justify-content:space-between; margin-top:8px; padding-top:8px; border-top:1px solid #f0f0f0; font-size:13px;">
        <span>Total pagado</span>
        <strong>${d(g+S)}</strong>
      </div>
      ${_>0?`
        <div style="display:flex; justify-content:space-between; margin-top:6px; color:#166534; font-size:13px; background:#dcfce7; padding:6px 8px; border-radius:6px;">
          <span>Vuelto</span>
          <strong>${d(_)}</strong>
        </div>
        ${(()=>{let e=(r||[]).find(e=>e.method===`efectivo`)||{},t=[];return e.changeBills&&t.push(n(e.changeBills)),parseFloat(e.vueltoBs)>0&&t.push(`Bs ${Math.round(parseFloat(e.vueltoBs)).toLocaleString(`es-VE`)} efectivo`),parseFloat(e.vueltoPm)>0&&t.push(`$${parseFloat(e.vueltoPm).toFixed(2)} pago móvil${e.vueltoPmReference?` (Ref: ${e.vueltoPmReference})`:``}`),parseFloat(e.vueltoCredito)>0&&t.push(`$${parseFloat(e.vueltoCredito).toFixed(2)} crédito en tienda`),t.length>0?`
            <div style="margin-top:4px; font-size:11px; color:#374151;">${t.join(` · `)}</div>
          `:``})()}
      `:``}
    `:``,E=v?`
      <div style="border-top:1px dashed #d1d5db; padding-top:12px; margin-top:12px;">
        <div style="font-size:10px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Cliente</div>
        <div style="font-weight:600; color:#1f2937;">${v}</div>
        ${y?`<div style="font-size:12px; color:#6b7280; margin-top:2px;">Cédula: ${y}</div>`:``}
        ${b?`<div style="font-size:12px; color:#6b7280; margin-top:2px;">Teléfono: ${b}</div>`:``}
      </div>
    `:``,D=e?.notes?`
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
        <title>Recibo ${h}</title>
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
            <div class="meta-row"><span>Recibo</span><strong>#${h}</strong></div>
            <div class="meta-row"><span>Fecha</span><strong>${m.toLocaleString()}</strong></div>
            ${e?.movement_type?`<div class="meta-row"><span>Tipo</span><strong>${e.movement_type.toUpperCase()}</strong></div>`:``}
            ${e?.status?`<div class="meta-row"><span>Estado</span><strong>${e.status.toUpperCase()}</strong></div>`:``}
          </div>
          ${E}
          <div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;">
            <div class="section-title">Productos</div>
            ${w}
          </div>
          <div>
            <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px;">
              <span>Subtotal</span>
              <span>${d(a||f)}</span>
            </div>
            ${x>0?`
              <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#16a34a;">
                <span>Descuento ${C?`(${C})`:``}</span>
                <span>-${d(x)}</span>
              </div>
            `:``}
            ${S>0?`
              <div class="total-row" style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:13px; color:#166534;">
                <span>Crédito usado</span>
                <span>-${d(S)}</span>
              </div>
            `:``}
            <div class="total-box">
              <span>Total</span>
              <span>${d(f)}</span>
            </div>
          </div>
          ${r||S>0?`<div style="border-top:1px dashed #d1d5db; padding-top:14px; margin-top:14px;"><div class="section-title">Pagos</div>${T}</div>`:``}
          ${D}
          <div class="footer">¡Gracias por su compra!</div>
        </div>
      </body>
    </html>
  `}function p(e){let t=document.createElement(`iframe`);t.style.position=`fixed`,t.style.top=`-9999px`,t.style.left=`-9999px`,t.style.width=`100%`,t.style.height=`0`,t.style.border=`none`,t.style.opacity=`0`,t.style.pointerEvents=`none`,document.body.appendChild(t);let n=t.contentWindow.document;n.open(),n.write(f(e)),n.close();let r=()=>{t.contentWindow.focus(),t.contentWindow.print()};t.contentWindow.document.readyState===`complete`?r():t.onload=r,setTimeout(()=>{document.body.contains(t)&&document.body.removeChild(t)},6e4)}export{p as n,c as t};