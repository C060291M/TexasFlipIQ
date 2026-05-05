'use client';
import type { PropertyInput, RehabResult, DealResult, RiskFlag } from '@/types';

const fmt = (n: number) =>
  isNaN(n) || !isFinite(n) ? '--'
  : '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

const pct = (n: number) =>
  isNaN(n) || !isFinite(n) ? '--'
  : (Math.round(n * 10) / 10) + '%';

// ── Metric Card ───────────────────────────────────────────────

function Card({
  label, value, sub, tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  const color =
    tone === 'good' ? '#1a8a82' :
    tone === 'warn' ? '#E07B2A' :
    tone === 'bad'  ? '#C0392B' : '#1F3A5F';

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #DDE3EC',
      borderRadius: 10,
      padding: '14px 16px',
      boxShadow: '0 1px 3px rgba(31,58,95,0.06)',
    }}>
      <div style={{
        fontSize: 10, color: '#6B7C93', marginBottom: 4,
        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: '#6B7C93', marginTop: 2 }}>{sub}</div>
      )}
    </div>
  );
}

// ── Risk Badge with optional action button ────────────────────

function RiskBadge({
  r, actionLabel, onAction,
}: {
  r: RiskFlag;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const styles = {
    danger:  { bg: '#fdecea', border: '#C0392B', color: '#922b21', icon: '🚨' },
    warning: { bg: '#fef5e7', border: '#E07B2A', color: '#935116', icon: '⚠'  },
    info:    { bg: '#e8f4f8', border: '#2980b9', color: '#1a6080', icon: 'ℹ'  },
  };
  const st = styles[r.severity];

  return (
    <div style={{
      background: st.bg,
      borderLeft: `3px solid ${st.border}`,
      borderRadius: 6,
      padding: '10px 14px',
      marginBottom: 8,
      fontSize: 12,
      lineHeight: 1.6,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: st.color }}>{st.icon} {r.title}</div>
          <div style={{ marginTop: 2, color: '#1F3A5F' }}>{r.description}</div>
          {r.mitigation && (
            <div style={{ marginTop: 4, color: '#6B7C93', fontStyle: 'italic' }}>
              Fix: {r.mitigation}
            </div>
          )}
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            style={{
              flexShrink: 0,
              padding: '6px 14px',
              background: st.border,
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              alignSelf: 'center',
            }}>
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Waterfall Row ─────────────────────────────────────────────

function WaterfallRow({
  label, value, note, type,
}: {
  label: string;
  value: string;
  note?: string;
  type: 'pos' | 'neg' | 'neutral' | 'total';
}) {
  const rowStyle: Record<string, React.CSSProperties> = {
    pos:     { background: '#e8faf9', color: '#1a8a82', border: '1px solid #b2ebe7' },
    neg:     { background: '#fdecea', color: '#922b21', border: '1px solid #f5b7b1' },
    neutral: { background: '#F5F6F8', color: '#1F3A5F', border: '1px solid #DDE3EC' },
    total:   { background: '#1F3A5F', color: '#FFFFFF', border: 'none', fontWeight: 700 },
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '9px 14px',
      borderRadius: 6,
      fontSize: 13,
      ...rowStyle[type],
    }}>
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {note && (
          <span style={{
            fontSize: 10,
            background: '#e8faf9',
            color: '#1a8a82',
            padding: '1px 6px',
            borderRadius: 6,
            fontWeight: 600,
          }}>
            {note}
          </span>
        )}
        <span style={{ fontFamily: 'monospace' }}>{value}</span>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────

interface Props {
  input: PropertyInput;
  rehab: RehabResult;
  fullRehab: RehabResult;
  deal: DealResult;
  risks: RiskFlag[];
  onUpdatePurchasePrice?: (price: number) => void;
}

// ── Main Component ────────────────────────────────────────────

export function DealOverviewPanel({
  input, rehab, fullRehab, deal, risks, onUpdatePurchasePrice,
}: Props) {
  const isFlip     = input.exitStrategy === 'flip';
  const score      = deal.dealScore;
  const scoreColor = score.score >= 70 ? '#2EC4B6' : score.score >= 45 ? '#E07B2A' : '#C0392B';
  const arc        = (score.score / 100) * 201.1;
  const rehabAdj   = rehab.total < fullRehab.total;
  const savedAmt   = fullRehab.total - rehab.total;

  // MAO = ARV x 70% minus rehab cost
  const mao = deal.flip?.maxAllowableOffer ?? 0;

  // Waterfall rows — plain text labels only (no special chars)
  const flipRows = [
    { label: 'ARV',                    value: fmt(input.arv),                                                           note: undefined,                                       type: 'pos'     as const },
    { label: 'Purchase price',         value: fmt(input.purchasePrice),                                                 note: undefined,                                       type: 'neg'     as const },
    { label: 'Rehab cost',             value: fmt(rehab.total),                                                         note: rehabAdj ? `${fmt(savedAmt)} saved` : undefined, type: 'neg'     as const },
    { label: 'Carrying costs',         value: fmt(deal.loan.totalCarryingCost),                                         note: undefined,                                       type: 'neg'     as const },
    { label: 'Closing costs (buy)',    value: fmt(deal.texasCosts.titleEscrowBuy),                                       note: undefined,                                       type: 'neg'     as const },
    { label: 'Property tax',           value: fmt(deal.texasCosts.propertyTax),                                         note: undefined,                                       type: 'neg'     as const },
    { label: 'Realtor + sell closing', value: fmt(deal.texasCosts.realtorCommission + deal.texasCosts.titleEscrowSell), note: undefined,                                       type: 'neg'     as const },
    { label: 'Net profit',             value: fmt(deal.flip?.netProfit ?? 0),                                           note: undefined,                                       type: 'total'   as const },
  ];

  const rentalRows = [
    { label: 'Gross annual rent',      value: fmt((deal.rental?.grossMonthlyRent ?? 0) * 12), note: undefined, type: 'pos'     as const },
    { label: 'Operating expenses',     value: fmt(deal.rental?.operatingExpenses ?? 0),       note: undefined, type: 'neg'     as const },
    { label: 'NOI',                    value: fmt(deal.rental?.noi ?? 0),                     note: undefined, type: 'neutral' as const },
    { label: 'Annual debt service',    value: fmt(deal.rental?.annualDebtService ?? 0),       note: undefined, type: 'neg'     as const },
    { label: 'Annual cash flow',       value: fmt(deal.rental?.annualCashFlow ?? 0),          note: undefined, type: 'total'   as const },
  ];

  const rows = isFlip ? flipRows : rentalRows;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Deal score card ──────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 20,
        background: '#FFFFFF', border: '1px solid #DDE3EC',
        borderRadius: 12, padding: 20,
        boxShadow: '0 2px 8px rgba(31,58,95,0.08)',
      }}>
        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
          <svg viewBox="0 0 80 80" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
            <circle cx="40" cy="40" r="32" fill="none" stroke="#EEF1F6" strokeWidth="7" />
            <circle cx="40" cy="40" r="32" fill="none" stroke={scoreColor} strokeWidth="7"
              strokeDasharray={`${arc} 201.1`} strokeLinecap="round" />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: scoreColor,
          }}>
            {score.score}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor, marginBottom: 4 }}>
            {score.label} — Grade {score.grade}
          </div>
          <div style={{ fontSize: 13, color: '#6B7C93', lineHeight: 1.6 }}>
            {score.explanation}
          </div>
          <div style={{ fontSize: 11, color: '#A8BFDA', marginTop: 4 }}>
            {rehab.regionLabel} · {input.condition} · {input.sqft.toLocaleString()} sqft · built {input.yearBuilt}
            {rehabAdj && (
              <span style={{ color: '#2EC4B6', marginLeft: 8, fontWeight: 600 }}>
                · Scope adjusted ({fmt(savedAmt)} saved)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Key metrics grid ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {isFlip ? (
          <>
            <Card
              label="Net profit"
              value={fmt(deal.flip?.netProfit ?? 0)}
              sub="After all TX costs"
              tone={(deal.flip?.netProfit ?? 0) > 30000 ? 'good' : (deal.flip?.netProfit ?? 0) > 0 ? 'warn' : 'bad'}
            />
            <Card
              label="ROI"
              value={pct(deal.flip?.roi ?? 0)}
              sub="Return on invested capital"
              tone={(deal.flip?.roi ?? 0) > 18 ? 'good' : (deal.flip?.roi ?? 0) > 10 ? 'warn' : 'bad'}
            />
            <Card
              label="Annualized ROI"
              value={pct(deal.flip?.annualizedRoi ?? 0)}
              sub={`${input.holdingMonths}mo hold adjusted`}
            />
            <Card
              label="ARV"
              value={fmt(input.arv)}
              sub="After repair value"
            />
            <Card
              label="MAO (70% rule minus rehab)"
              value={fmt(mao)}
              sub="Max allowable offer"
            />
            <Card
              label="Total project cost"
              value={fmt(deal.flip?.totalProjectCost ?? 0)}
              sub="All-in investment"
            />
          </>
        ) : (
          <>
            <Card
              label="Annual cash flow"
              value={fmt(deal.rental?.annualCashFlow ?? 0)}
              sub="After expenses + debt service"
              tone={(deal.rental?.annualCashFlow ?? 0) > 5000 ? 'good' : (deal.rental?.annualCashFlow ?? 0) > 0 ? 'warn' : 'bad'}
            />
            <Card
              label="Cash-on-cash return"
              value={pct(deal.rental?.cashOnCashReturn ?? 0)}
              sub="Annual CoC ROI"
              tone={(deal.rental?.cashOnCashReturn ?? 0) > 10 ? 'good' : (deal.rental?.cashOnCashReturn ?? 0) > 5 ? 'warn' : 'bad'}
            />
            <Card
              label="DSCR"
              value={`${deal.rental?.dscr?.toFixed(2) ?? '--'}x`}
              sub="Debt service coverage ratio"
              tone={(deal.rental?.dscr ?? 0) > 1.25 ? 'good' : (deal.rental?.dscr ?? 0) > 1 ? 'warn' : 'bad'}
            />
            <Card
              label="Monthly rent"
              value={fmt(deal.rental?.grossMonthlyRent ?? 0)}
              sub={input.exitStrategy === 'str' ? 'Avg nightly x occupancy' : 'Gross monthly rent'}
            />
            <Card
              label="NOI (annual)"
              value={fmt(deal.rental?.noi ?? 0)}
              sub="Net operating income"
            />
            <Card
              label="Cap rate"
              value={pct(deal.rental?.capRate ?? 0)}
              sub="Unleveraged return on value"
            />
          </>
        )}
      </div>

      {/* ── Waterfall + Risk flags ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Profit waterfall */}
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#1F3A5F',
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            Profit waterfall
            {rehabAdj && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: '#2EC4B6',
                background: '#e8faf9', padding: '2px 8px', borderRadius: 10,
              }}>
                Scope adjusted
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {rows.map((row, i) => (
              <WaterfallRow
                key={i}
                label={row.label}
                value={row.value}
                note={row.note}
                type={row.type}
              />
            ))}
          </div>

          {/* MAO box — shows when purchase price exceeds MAO */}
          {isFlip && mao > 0 && input.purchasePrice > mao && onUpdatePurchasePrice && (
            <div style={{
              marginTop: 10,
              background: '#fef5e7',
              border: '1px solid #E07B2A',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                <strong>Purchase price exceeds MAO.</strong><br />
                Max allowable offer: <strong style={{ fontFamily: 'monospace' }}>{fmt(mao)}</strong><br />
                <span style={{ fontSize: 10, color: '#92400e', opacity: 0.85 }}>
                  Calculated as (ARV x 70%) minus rehab cost of {fmt(rehab.total)}
                </span>
              </div>
              <button
                onClick={() => onUpdatePurchasePrice(mao)}
                style={{
                  flexShrink: 0, padding: '8px 16px',
                  background: '#E07B2A', color: '#fff',
                  border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                Use MAO {fmt(mao)}
              </button>
            </div>
          )}

          {/* MAO box — shows when no purchase price entered yet */}
          {isFlip && mao > 0 && input.purchasePrice === 0 && onUpdatePurchasePrice && (
            <div style={{
              marginTop: 10,
              background: '#e8faf9',
              border: '1px solid #2EC4B6',
              borderRadius: 8,
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <div style={{ fontSize: 12, color: '#1a8a82', lineHeight: 1.6 }}>
                <strong>MAO calculated from your ARV and rehab.</strong><br />
                Suggested max offer: <strong style={{ fontFamily: 'monospace' }}>{fmt(mao)}</strong><br />
                <span style={{ fontSize: 10, color: '#065f46', opacity: 0.85 }}>
                  Calculated as (ARV x 70%) minus rehab cost of {fmt(rehab.total)}
                </span>
              </div>
              <button
                onClick={() => onUpdatePurchasePrice(mao)}
                style={{
                  flexShrink: 0, padding: '8px 16px',
                  background: '#2EC4B6', color: '#fff',
                  border: 'none', borderRadius: 6,
                  fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                Use MAO {fmt(mao)}
              </button>
            </div>
          )}
        </div>

        {/* Risk flags */}
        <div>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#1F3A5F',
            marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            Risk flags ({risks.length})
          </div>

          {risks.map(r => {
            // Add Use MAO button to the 70% rule violation flag
            const isMaoFlag =
              r.id === 'flip-70-rule' ||
              r.id === 'flip-70-rule-violation';
            const showMaoBtn = isMaoFlag && mao > 0 && onUpdatePurchasePrice;

            return (
              <RiskBadge
                key={r.id}
                r={r}
                actionLabel={showMaoBtn ? `Use MAO ${fmt(mao)}` : undefined}
                onAction={showMaoBtn ? () => onUpdatePurchasePrice!(mao) : undefined}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
