import { useMemo, useState } from 'react';

type RiskLevel = 'Düşük' | 'Orta' | 'Yüksek';

const baseValues = {
  bankaToplami: 1_000_000,
  posToplami: 820_000,
  beyanEdilenCiro: 730_000,
};

const missingDocuments = [
  'POS faturası eksik',
  'Açıklamasız EFT var',
  'Emanet para kaydı eksik',
];

const recentTransactions = [
  {
    date: '05.03.2026',
    description: 'POS',
    amount: '48.500 TL',
    type: 'POS Tahsilatı',
    risk: 'Düşük',
    status: 'Tamam',
  },
  {
    date: '08.03.2026',
    description: 'Ortak',
    amount: '100.000 TL',
    type: 'Ortak Borcu',
    risk: 'Orta',
    status: 'Kontrol',
  },
  {
    date: '10.03.2026',
    description: 'EFT',
    amount: '55.000 TL',
    type: 'Belirsiz',
    risk: 'Yüksek',
    status: 'İncelenecek',
  },
] as const;

const riskClassMap: Record<RiskLevel, string> = {
  Düşük: 'tag low',
  Orta: 'tag medium',
  Yüksek: 'tag high',
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const scoreToRiskMeta = (score: number) => {
  if (score >= 75) {
    return {
      level: 'Yüksek' as RiskLevel,
      description: 'Yüksek risk – inceleme ihtimali var',
    };
  }

  if (score >= 45) {
    return {
      level: 'Orta' as RiskLevel,
      description: 'Orta risk – ek belge ve işlem doğrulaması önerilir',
    };
  }

  return {
    level: 'Düşük' as RiskLevel,
    description: 'Düşük risk – mevcut veriler dengeli görünüyor',
  };
};

function App() {
  const [hesap131, setHesap131] = useState<number>(0);
  const [hesap331, setHesap331] = useState<number>(0);

  const analysis = useMemo(() => {
    const fark = Math.max(baseValues.bankaToplami - baseValues.beyanEdilenCiro, 0);
    const neutralizedPart = Math.min(fark, hesap331 * 0.65);
    const effectiveGap = Math.max(fark - neutralizedPart, 0);

    let score = 40;
    score += Math.min((effectiveGap / baseValues.beyanEdilenCiro) * 120, 45);

    const messages: string[] = [];

    if (baseValues.bankaToplami > baseValues.beyanEdilenCiro) {
      if (hesap331 > 0) {
        messages.push('Ortak finansmanı olabilir');
        score -= Math.min((neutralizedPart / baseValues.beyanEdilenCiro) * 65, 25);
      } else {
        messages.push('Açıklanamayan banka girişi');
        score += 14;
      }
    }

    const yuksek131Esigi = baseValues.beyanEdilenCiro * 0.2;
    if (hesap131 >= yuksek131Esigi) {
      messages.push('Ortaklardan alacak yüksek, kasa/banka hareketleri kontrol edilmeli');
      score += 12;
    }

    score = Math.max(0, Math.min(Math.round(score), 100));
    const riskMeta = scoreToRiskMeta(score);

    return {
      score,
      level: riskMeta.level,
      description: riskMeta.description,
      messages,
      fark,
      neutralizedPart,
      effectiveGap,
    };
  }, [hesap131, hesap331]);

  const summaryCards = [
    { label: 'Banka Toplamı', value: formatCurrency(baseValues.bankaToplami) },
    { label: 'POS Toplamı', value: formatCurrency(baseValues.posToplami) },
    { label: 'Beyan Edilen Ciro', value: formatCurrency(baseValues.beyanEdilenCiro) },
    { label: '131 Ortaklardan Alacak', value: formatCurrency(hesap131) },
    { label: '331 Ortaklara Borç', value: formatCurrency(hesap331) },
    { label: 'Risk Puanı', value: `${analysis.score}`, isRisk: true },
  ];

  return (
    <div className="dashboard">
      <header>
        <h1>KAPLAN UYUM &amp; RİSK ANALİZ SİSTEMİ</h1>
        <p className="subtitle">Mali veri karşılaştırma ve uyum değerlendirme paneli</p>
      </header>

      <section className="card input-card" aria-label="Manuel hesap girişleri">
        <h3>Manuel Giriş</h3>
        <div className="manual-grid">
          <label>
            131 Ortaklardan Alacak
            <input
              type="number"
              min={0}
              step={1000}
              value={hesap131}
              onChange={(event) => setHesap131(Math.max(Number(event.target.value), 0))}
            />
          </label>
          <label>
            331 Ortaklara Borç
            <input
              type="number"
              min={0}
              step={1000}
              value={hesap331}
              onChange={(event) => setHesap331(Math.max(Number(event.target.value), 0))}
            />
          </label>
        </div>
        <p className="input-note">Bu hesaplar uyum skoruna doğrudan dahil edilir.</p>
      </section>

      <section className="summary-grid" aria-label="Özet kartlar">
        {summaryCards.map((card) => (
          <article key={card.label} className="card summary-card">
            <p>{card.label}</p>
            <h2 className={card.isRisk ? `risk-score ${analysis.level.toLowerCase()}` : ''}>{card.value}</h2>
          </article>
        ))}
      </section>

      <section className={`card risk-alert ${analysis.level.toLowerCase()}`} aria-label="Risk durumu">
        <h3>Risk durumu: {analysis.level}</h3>
        <p>{analysis.description}</p>
        <small>
          Banka-Ciro farkı: {formatCurrency(analysis.fark)} | 331 ile nötralize edilen kısım:{' '}
          {formatCurrency(analysis.neutralizedPart)} | Kalan fark: {formatCurrency(analysis.effectiveGap)}
        </small>
      </section>

      <section className="card analysis-card" aria-label="Uyum analizi mesajları">
        <h3>Uyum Analizi</h3>
        {analysis.messages.length > 0 ? (
          <ul>
            {analysis.messages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : (
          <p className="no-warning">Ek bir risk uyarısı yok.</p>
        )}
      </section>

      <section className="lower-grid">
        <article className="card">
          <h3>Eksik Belgeler</h3>
          <ul>
            {missingDocuments.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="card table-card">
          <h3>Son İşlemler</h3>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th>Tutar</th>
                  <th>Tür</th>
                  <th>Risk</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={`${transaction.date}-${transaction.description}`}>
                    <td>{transaction.date}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.amount}</td>
                    <td>{transaction.type}</td>
                    <td>
                      <span className={riskClassMap[transaction.risk]}>{transaction.risk}</span>
                    </td>
                    <td>{transaction.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <style>{`
        .dashboard {
          color: #e9f0ff;
          min-height: 100vh;
          padding: 2.5rem clamp(1rem, 3vw, 3rem);
          background: linear-gradient(180deg, #041228 0%, #061833 55%, #031126 100%);
        }

        h1 {
          margin: 0;
          font-size: clamp(1.3rem, 2.7vw, 2.2rem);
          letter-spacing: 0.03em;
        }

        .subtitle {
          margin-top: 0.45rem;
          color: #9bb2de;
        }

        .card {
          background: rgba(15, 44, 94, 0.45);
          border: 1px solid rgba(151, 186, 255, 0.16);
          border-radius: 16px;
          padding: 1rem 1.2rem;
          backdrop-filter: blur(9px);
          box-shadow: 0 10px 22px rgba(0, 6, 22, 0.32);
        }

        .input-card {
          margin-top: 1.4rem;
        }

        .manual-grid {
          margin-top: 0.85rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 0.9rem;
        }

        label {
          display: grid;
          gap: 0.45rem;
          color: #c8d8f8;
          font-size: 0.92rem;
        }

        input {
          padding: 0.62rem 0.75rem;
          border-radius: 10px;
          border: 1px solid rgba(154, 186, 240, 0.36);
          background: rgba(5, 21, 46, 0.78);
          color: #f2f6ff;
          outline: none;
        }

        input:focus {
          border-color: #7caeff;
          box-shadow: 0 0 0 3px rgba(124, 174, 255, 0.24);
        }

        .input-note {
          margin: 0.7rem 0 0;
          color: #9cb6e5;
          font-size: 0.9rem;
        }

        .summary-grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
          gap: 1rem;
        }

        .summary-card p {
          margin: 0;
          color: #9cb6e5;
          font-size: 0.92rem;
        }

        .summary-card h2 {
          margin: 0.55rem 0 0;
          font-size: 1.35rem;
        }

        .risk-score {
          font-weight: 700;
        }

        .risk-score.yüksek {
          color: #ff7070;
        }

        .risk-score.orta {
          color: #ffd48d;
        }

        .risk-score.düşük {
          color: #9bf1bd;
        }

        .risk-alert,
        .analysis-card {
          margin-top: 1rem;
        }

        .risk-alert {
          border-left: 4px solid #ff7070;
        }

        .risk-alert.orta {
          border-left-color: #f0b557;
        }

        .risk-alert.düşük {
          border-left-color: #56d28a;
        }

        .risk-alert h3,
        .risk-alert p,
        .card h3 {
          margin: 0;
        }

        .risk-alert p {
          margin-top: 0.5rem;
          color: #dbe7ff;
        }

        .risk-alert small {
          display: block;
          margin-top: 0.5rem;
          color: #9db7e6;
        }

        ul {
          margin: 0.85rem 0 0;
          padding-left: 1.2rem;
          display: grid;
          gap: 0.6rem;
          color: #d8e4fd;
        }

        .no-warning {
          margin: 0.8rem 0 0;
          color: #bcd1f6;
        }

        .lower-grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: minmax(220px, 320px) 1fr;
          gap: 1rem;
        }

        .table-card {
          overflow: hidden;
        }

        .table-wrapper {
          margin-top: 0.8rem;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 700px;
          font-size: 0.93rem;
        }

        th,
        td {
          text-align: left;
          padding: 0.72rem;
          border-bottom: 1px solid rgba(162, 188, 237, 0.16);
        }

        th {
          color: #9db6e3;
          font-weight: 600;
          font-size: 0.84rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        .tag {
          display: inline-block;
          padding: 0.22rem 0.58rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .tag.low {
          color: #9bf1bd;
          background: rgba(52, 153, 83, 0.25);
        }

        .tag.medium {
          color: #ffd48d;
          background: rgba(168, 114, 13, 0.25);
        }

        .tag.high {
          color: #ff9d9d;
          background: rgba(169, 38, 38, 0.28);
        }

        @media (max-width: 960px) {
          .lower-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default App;
