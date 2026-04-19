const summaryCards = [
  { label: 'Banka Toplamı', value: '1.000.000 TL' },
  { label: 'POS Toplamı', value: '820.000 TL' },
  { label: 'Beyan Edilen Ciro', value: '730.000 TL' },
  { label: 'Risk Puanı', value: '82', isRisk: true },
];

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
];

const riskClassMap: Record<string, string> = {
  Düşük: 'tag low',
  Orta: 'tag medium',
  Yüksek: 'tag high',
};

function App() {
  return (
    <div className="dashboard">
      <header>
        <h1>KAPLAN UYUM &amp; RİSK ANALİZ SİSTEMİ</h1>
        <p className="subtitle">Mali veri karşılaştırma ve uyum değerlendirme paneli</p>
      </header>

      <section className="summary-grid" aria-label="Özet kartlar">
        {summaryCards.map((card) => (
          <article key={card.label} className="card summary-card">
            <p>{card.label}</p>
            <h2 className={card.isRisk ? 'risk-score' : ''}>{card.value}</h2>
          </article>
        ))}
      </section>

      <section className="card risk-alert" aria-label="Risk durumu">
        <h3>Risk durumu</h3>
        <p>Yüksek risk – inceleme ihtimali var</p>
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

        .summary-grid {
          margin-top: 1.6rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(185px, 1fr));
          gap: 1rem;
        }

        .card {
          background: rgba(15, 44, 94, 0.45);
          border: 1px solid rgba(151, 186, 255, 0.16);
          border-radius: 16px;
          padding: 1rem 1.2rem;
          backdrop-filter: blur(9px);
          box-shadow: 0 10px 22px rgba(0, 6, 22, 0.32);
        }

        .summary-card p {
          margin: 0;
          color: #9cb6e5;
          font-size: 0.92rem;
        }

        .summary-card h2 {
          margin: 0.55rem 0 0;
          font-size: 1.5rem;
        }

        .risk-score {
          color: #ff7070;
        }

        .risk-alert {
          margin-top: 1rem;
          border-left: 4px solid #ff7070;
          background: rgba(79, 16, 36, 0.35);
        }

        .risk-alert h3,
        .risk-alert p,
        .card h3 {
          margin: 0;
        }

        .risk-alert p {
          margin-top: 0.5rem;
          color: #ffd7d7;
        }

        .lower-grid {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: minmax(220px, 320px) 1fr;
          gap: 1rem;
        }

        ul {
          margin: 0.85rem 0 0;
          padding-left: 1.2rem;
          display: grid;
          gap: 0.6rem;
          color: #d8e4fd;
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
