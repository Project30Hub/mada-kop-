// Transactional email via Resend. Never throws: a failed email must never fail a signup or an order.
// Env: RESEND_API_KEY (already set), MAIL_FROM (optional, e.g. 'MadaKop <orders@yourdomain.co.za>'), SITE_URL (optional, e.g. https://madakop.vercel.app)
const { serviceClient, configStatus } = require('./supabase');

const FROM = process.env.MAIL_FROM || 'MadaKop <onboarding@resend.dev>';
const LIME = '#bfff3c';
const PINK = '#e91e8c';
const NL = String.fromCharCode(10);

const esc = s => String(s == null ? '' : s).split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;').split(String.fromCharCode(39)).join('&#39;');
const rand = n => 'R' + Number(n || 0).toFixed(2);
const first = n => String(n || '').trim().split(' ')[0] || 'there';

function siteUrl(req) {
  const fixed = String(process.env.SITE_URL || '').trim().replace(/[/]+$/, '');
  if (/^https:[/][/][a-z0-9.-]+$/i.test(fixed)) return fixed;
  const raw = req && req.headers ? (req.headers['x-forwarded-host'] || req.headers.host) : '';
  const host = String(raw || '').split(',')[0].trim();
  return /^[a-z0-9.-]+$/i.test(host) ? 'https://' + host : '';
}

function layout(inner) {
  return `<!DOCTYPE html><html><body style='margin:0;background:#0d0d0d;font-family:Arial,sans-serif;color:#f5f5f0'>
<table width='100%' cellpadding='0' cellspacing='0' style='background:#0d0d0d;padding:24px 12px'><tr><td align='center'>
<table width='100%' cellpadding='0' cellspacing='0' style='max-width:560px;background:#161616;border-radius:14px;overflow:hidden;border:1px solid #2a2a2a'>
<tr><td style='padding:24px;text-align:center;border-bottom:3px solid ${LIME}'><div style='font-size:34px;font-weight:900;letter-spacing:5px;color:${LIME}'>MADA<span style='color:${PINK}'>KOP</span></div></td></tr>
<tr><td style='padding:28px;font-size:15px;line-height:1.6'>${inner}</td></tr>
<tr><td style='padding:18px 28px;text-align:center;font-size:11px;color:#777;border-top:1px solid #2a2a2a'>MadaKop Healing Hub and Private Club - 18+ only - Members must comply with South African cannabis laws<br>WhatsApp 073 629 2224</td></tr>
</table></td></tr></table></body></html>`;
}

const btn = (href, label) => href ? `<p style='margin:24px 0 0'><a href='${esc(href)}' style='display:inline-block;background:${LIME};color:#0d0d0d;font-weight:800;text-decoration:none;padding:14px 28px;border-radius:8px'>${esc(label)}</a></p>` : '';
const h1 = t => `<h1 style='margin:0 0 12px;font-size:24px;color:#f5f5f0'>${t}</h1>`;

function mapsUrl(o) {
  if (o.latitude != null && o.longitude != null) return 'https://www.google.com/maps/search/?api=1&query=' + o.latitude + ',' + o.longitude;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([o.address_line, o.city, o.zip].filter(Boolean).join(', '));
}
const addrLine = o => [o.address_line, o.city, o.zip].filter(Boolean).join(', ');
const itemRows = o => (o.items || []).map(i => `<tr><td style='padding:6px 0;color:#ddd'>${esc(i.quantity)} x ${esc(i.product_name)}</td><td align='right' style='padding:6px 0;color:#ddd'>${rand(i.line_total)}</td></tr>`).join('');
const itemText = o => (o.items || []).map(i => i.quantity + ' x ' + i.product_name + '  ' + rand(i.line_total)).join(NL);
const payNote = o => o.payment_method === 'eft' ? 'EFT - the club will send you the bank details on WhatsApp.' : 'Cash on delivery - please have the exact amount ready.';

function welcomeEmail(name, site) {
  return {
    subject: 'Welcome to MadaKop - we got your membership request',
    html: layout(h1('Welcome, ' + esc(first(name)) + '!') + `<p style='color:#ccc'>Thanks for joining MadaKop. Your membership request is with the club and is waiting for approval.</p><p style='color:#ccc'>We will email you as soon as you are approved. After that you can browse the menu and order straight from your phone.</p>` + btn(site ? site + '/club.html' : '', 'Open MadaKop')),
    text: 'Welcome to MadaKop, ' + first(name) + '!' + NL + 'Your membership request is waiting for approval. We will email you as soon as you are approved.' + (site ? NL + site + '/club.html' : '')
  };
}

function approvedEmail(name, site) {
  return {
    subject: 'Your MadaKop membership is approved',
    html: layout(h1('You are in, ' + esc(first(name)) + '!') + `<p style='color:#ccc'>Your membership is approved. You can now see the menu and place orders.</p>` + btn(site ? site + '/club.html' : '', 'Order now')),
    text: 'Your MadaKop membership is approved. You can now order.' + (site ? NL + site + '/club.html' : '')
  };
}

function orderConfirmEmail(o, site) {
  return {
    subject: 'Order ' + o.order_number + ' received',
    html: layout(h1('Order ' + esc(o.order_number) + ' received') + `<p style='color:#ccc'>Thanks, ${esc(first(o.customer_name))}. The club will confirm your order shortly.</p>
<table width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a;margin:16px 0'>${itemRows(o)}
<tr><td style='padding:6px 0;color:#999'>Delivery</td><td align='right' style='padding:6px 0;color:#999'>${rand(o.delivery_fee)}</td></tr>
<tr><td style='padding:8px 0;font-weight:800'>Total</td><td align='right' style='padding:8px 0;font-weight:800;color:${LIME}'>${rand(o.total)}</td></tr></table>
<p style='color:#ccc;margin:0 0 6px'><b>Delivering to:</b><br>${esc(addrLine(o))}</p>
<p style='color:#ccc;margin:0'><b>Payment:</b> ${esc(payNote(o))}</p>` + btn(site ? site + '/club.html' : '', 'Track my order')),
    text: 'Order ' + o.order_number + ' received' + NL + itemText(o) + NL + 'Delivery ' + rand(o.delivery_fee) + NL + 'Total ' + rand(o.total) + NL + 'Delivering to: ' + addrLine(o) + NL + payNote(o)
  };
}

function newOrderStaffEmail(o, site) {
  return {
    subject: 'New order ' + o.order_number + ' - ' + rand(o.total),
    html: layout(h1('New order ' + esc(o.order_number)) + `<p style='color:#ccc;margin:0 0 8px'><b>${esc(o.customer_name)}</b> - ${esc(o.customer_phone)}<br>${esc(addrLine(o))}</p>
<table width='100%' cellpadding='0' cellspacing='0' style='border-top:1px solid #2a2a2a;border-bottom:1px solid #2a2a2a;margin:12px 0'>${itemRows(o)}
<tr><td style='padding:8px 0;font-weight:800'>Total</td><td align='right' style='padding:8px 0;font-weight:800;color:${LIME}'>${rand(o.total)}</td></tr></table>
<p style='color:#ccc;margin:0'>${esc(payNote(o))}</p>
<p style='margin:12px 0 0'><a href='${esc(mapsUrl(o))}' style='color:${LIME}'>${o.latitude != null ? 'Open exact pin in Maps' : 'Open address in Maps'}</a></p>` + btn(site ? site + '/back-office.html' : '', 'Open back office')),
    text: 'New order ' + o.order_number + NL + o.customer_name + ' ' + o.customer_phone + NL + addrLine(o) + NL + itemText(o) + NL + 'Total ' + rand(o.total) + NL + mapsUrl(o)
  };
}

function newMemberStaffEmail(m, site) {
  return {
    subject: 'New membership request: ' + m.full_name,
    html: layout(h1('New membership request') + `<p style='color:#ccc'><b>${esc(m.full_name)}</b><br>${esc(m.email)}<br>${esc(m.phone)}</p><p style='color:#ccc'>They are waiting for approval under Members.</p>` + btn(site ? site + '/back-office.html' : '', 'Review in back office')),
    text: 'New membership request: ' + m.full_name + ' ' + m.email + ' ' + m.phone
  };
}

async function sendMail(msg) {
  const key = process.env.RESEND_API_KEY;
  const to = (Array.isArray(msg.to) ? msg.to : [msg.to]).filter(Boolean);
  if (!key || to.length === 0) return 'skipped';
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({ from: FROM, to, subject: msg.subject, html: msg.html, text: msg.text })
    });
    if (!r.ok) { console.error('mail failed:', r.status, (await r.text()).slice(0, 300)); return 'failed'; }
    return 'sent';
  } catch (e) {
    console.error('mail error:', e && e.message);
    return 'failed';
  } finally {
    clearTimeout(timer);
  }
}

// Active staff and admins get the club-side alerts.
async function staffEmails() {
  if (!configStatus().has_service_key) return [];
  try {
    const { data } = await serviceClient().from('profiles').select('email').in('role', ['admin', 'staff']).eq('member_status', 'active').limit(10);
    return (data || []).map(r => r.email).filter(Boolean);
  } catch (e) {
    return [];
  }
}

module.exports = { sendMail, staffEmails, siteUrl, welcomeEmail, approvedEmail, orderConfirmEmail, newOrderStaffEmail, newMemberStaffEmail };
