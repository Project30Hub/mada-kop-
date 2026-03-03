module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { firstName, lastName, email, code, tier } = req.body;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MadaKop <onboarding@resend.dev>',
        to: [email],
        subject: `Welcome to MadaKop, ${firstName}! 🌿 Your Member Code Inside`,
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MadaKop</title>
</head>
<body style="margin:0;padding:0;background:#0d0d0d;font-family:'DM Sans',Arial,sans-serif;color:#f5f5f0">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#161616;border-radius:16px;overflow:hidden;border:1px solid rgba(191,255,60,0.15)">

          <!-- HEADER -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a2a0a,#0d0d0d);padding:40px 40px 32px;text-align:center;border-bottom:3px solid #bfff3c">
              <div style="font-family:Arial,sans-serif;font-size:42px;font-weight:900;letter-spacing:6px;color:#bfff3c;line-height:1">MADA<span style="color:#e91e8c">KOP</span></div>
              <div style="font-size:11px;letter-spacing:4px;text-transform:uppercase;color:rgba(245,245,240,0.4);margin-top:8px">Healing Hub & Private Club · Est. 2025</div>
            </td>
          </tr>

          <!-- WELCOME -->
          <tr>
            <td style="padding:40px 40px 0">
              <div style="font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#bfff3c;font-weight:700;margin-bottom:10px">Welcome to the Family 🌿</div>
              <h1 style="font-size:28px;font-weight:800;margin:0 0 16px;color:#f5f5f0">Yo ${firstName}! You're in. 🤘</h1>
              <p style="font-size:15px;color:rgba(245,245,240,0.65);line-height:1.75;margin:0 0 28px">
                Welcome to MadaKop — Small Farm, Evaton's private cannabis club and healing hub. You're now part of a real community built on love, respect, and good vibes. One love.
              </p>
            </td>
          </tr>

          <!-- MK CODE -->
          <tr>
            <td style="padding:0 40px">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#bfff3c,#8fcc00);border-radius:12px;padding:28px;text-align:center">
                <tr>
                  <td>
                    <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#0d0d0d;font-weight:700;margin-bottom:8px">Your Member Code</div>
                    <div style="font-family:monospace;font-size:36px;font-weight:900;letter-spacing:6px;color:#0d0d0d">${code}</div>
                    <div style="font-size:11px;color:rgba(13,13,13,0.6);margin-top:8px;letter-spacing:1px">Save this — you'll need it to log in</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- TIER -->
          <tr>
            <td style="padding:24px 40px 0">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:rgba(233,30,140,0.08);border:1px solid rgba(233,30,140,0.2);border-radius:8px;padding:16px 20px">
                <tr>
                  <td>
                    <span style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#e91e8c;font-weight:700">Your Tier</span>
                    <span style="font-size:15px;font-weight:700;color:#f5f5f0;margin-left:12px">${tier} Member</span>
                  </td>
                  <td align="right">
                    <span style="font-size:13px;color:#bfff3c;font-weight:700">50 Welcome Points 🎉</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- WHAT'S NEXT -->
          <tr>
            <td style="padding:32px 40px 0">
              <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#bfff3c;font-weight:700;margin-bottom:16px">What's Next</div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span style="font-size:18px;margin-right:12px">🔐</span>
                    <span style="font-size:14px;color:rgba(245,245,240,0.8)">Log in with your MK code at <strong style="color:#bfff3c">madakop.vercel.app</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span style="font-size:18px;margin-right:12px">⭐</span>
                    <span style="font-size:14px;color:rgba(245,245,240,0.8)">Earn MK Points on every order — unlock better tiers</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                    <span style="font-size:18px;margin-right:12px">🚴</span>
                    <span style="font-size:14px;color:rgba(245,245,240,0.8)">Order via WhatsApp — <strong style="color:#bfff3c">073 629 2224</strong></span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0">
                    <span style="font-size:18px;margin-right:12px">📸</span>
                    <span style="font-size:14px;color:rgba(245,245,240,0.8)">Follow us on Instagram — <strong style="color:#bfff3c">@madakop_</strong></span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 40px">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://madakop.vercel.app/login.html" style="display:inline-block;background:#bfff3c;color:#0d0d0d;font-weight:800;font-size:14px;letter-spacing:3px;text-transform:uppercase;padding:16px 36px;border-radius:4px;text-decoration:none">Login to Dashboard →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background:#0d0d0d;padding:24px 40px;text-align:center;border-top:1px solid rgba(191,255,60,0.1)">
              <div style="font-size:11px;color:rgba(245,245,240,0.25);letter-spacing:1px;line-height:1.8">
                © 2025 MadaKop Healing Hub & Private Club · Small Farm, Evaton<br>
                18+ Only · Members must comply with South African cannabis laws<br>
                <span style="color:rgba(245,245,240,0.15)">This is a private members-only communication</span>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, id: data.id });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
