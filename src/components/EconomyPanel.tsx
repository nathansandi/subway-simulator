import React, { useState } from 'react';
import { Economy, Loan } from '../types';
import { DollarSign, Percent, TrendingUp, AlertTriangle, ShieldCheck } from 'lucide-react';

interface EconomyPanelProps {
  economy: Economy;
  onUpdateTicketPrice: (price: number) => void;
  onTakeLoan: (amount: number) => void;
  onRepayLoan: (loanId: string) => void;
}

export const EconomyPanel: React.FC<EconomyPanelProps> = ({
  economy,
  onUpdateTicketPrice,
  onTakeLoan,
  onRepayLoan
}) => {
  const [ticketInput, setTicketInput] = useState<number>(economy.ticketPrice);

  const handlePriceSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setTicketInput(val);
    onUpdateTicketPrice(val);
  };

  const activeLoanCount = economy.loans.length;
  const isDecliningBudget = economy.budget < 50000;

  return (
    <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 p-4 text-white shadow-xl flex flex-col gap-4" id="economy-panel-container">
      {/* Title */}
      <div className="flex items-center gap-2">
        <DollarSign className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-200">
          Financial Operations
        </h3>
      </div>

      {/* Ticket pricing controller slider */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2" id="ticket-price-control">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-400 font-sans">Single-Ride Subway Fare</span>
          <span className="text-sm font-mono font-bold text-amber-400">${ticketInput.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min="1.00"
          max="10.00"
          step="0.25"
          value={ticketInput}
          onChange={handlePriceSlide}
          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-white/10 rounded-lg outline-none"
        />
        <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
          Higher fares increase yield per rider, but excessive prices discourage casual commuters shifting back to highway vehicles!
        </p>
      </div>

      {/* Sheet Report: Hourly Costs vs Tickets Sold */}
      <div className="bg-white/5 rounded-xl border border-white/10 p-3" id="expenses-log-sheet">
        <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
          <span>Simulation Expenses</span>
          <span className="text-[10px] text-slate-500 font-normal">Hourly Loop Cycle</span>
        </h4>
        <div className="space-y-1.5 text-xs font-sans text-slate-300">
          <div className="flex justify-between">
            <span className="text-slate-400">⚡ Track & Hub Electricity</span>
            <span className="font-mono">${economy.expenses.electricity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">🔧 Platform Upkeep Maintenance</span>
            <span className="font-mono">${economy.expenses.maintenance.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">👥 Technical Dispatch Crew Staffing</span>
            <span className="font-mono">${economy.expenses.staff.toLocaleString()}</span>
          </div>
          {economy.expenses.loans > 0 && (
            <div className="flex justify-between text-rose-300">
              <span className="text-rose-400">💸 Loan Repayment Installments</span>
              <span className="font-mono">-${economy.expenses.loans.toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-white/5 my-2 pt-1.5 flex justify-between font-bold text-emerald-400">
            <span>Ticket Sales Revenue (Yield)</span>
            <span className="font-mono">+${economy.revenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Credit Line & Advanced Micro Loans */}
      <div className="space-y-2" id="loans-management-section">
        <div className="flex justify-between items-center">
          <h4 className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Percent className="w-3.5 h-3.5 text-indigo-400" /> Credit Expansion Line
          </h4>
          <span className="text-[10px] font-mono text-slate-500">
            {activeLoanCount}/3 Active
          </span>
        </div>

        {isDecliningBudget && (
          <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-[10px] text-rose-300 flex items-start gap-2 animate-bounce">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold">Caution: Funding is Critically Low!</p>
              <p className="opacity-80">Secure an expansion loan immediately to avoid construction freeze or bankruptcy operations!</p>
            </div>
          </div>
        )}

        {/* Secure loan packages buttons grid */}
        <div className="grid grid-cols-3 gap-1.5" id="loan-trigger-grid">
          {[100000, 250000, 500000].map((amt) => {
            const isDisabled = activeLoanCount >= 3;
            return (
              <button
                key={amt}
                onClick={() => onTakeLoan(amt)}
                disabled={isDisabled}
                className="py-1.5 px-2 bg-indigo-500/10 hover:bg-indigo-505/20 disabled:opacity-40 rounded-xl border border-indigo-500/30 font-mono text-[10px] font-bold text-center text-indigo-200 transition-all cursor-pointer hover:border-indigo-500/50 active:scale-95"
              >
                +${(amt / 1000).toFixed(0)}k
              </button>
            );
          })}
        </div>

        {/* List of outstanding loans to repay */}
        {economy.loans.length > 0 && (
          <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1" id="active-debts-list">
            {economy.loans.map((loan) => (
              <div
                key={loan.id}
                className="p-2 rounded-xl bg-black/40 border border-white/10 flex items-center justify-between text-[11px] font-sans"
              >
                <div>
                  <p className="font-semibold text-slate-300">
                    Loan Principal: <span className="font-mono text-amber-500">${loan.amount.toLocaleString()}</span>
                  </p>
                  <p className="text-[10px] text-slate-500 leading-none mt-1">
                    Paying <span className="font-mono text-indigo-400">${loan.paymentPerTick}/h</span> to settle
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRepayLoan(loan.id)}
                  disabled={economy.budget < loan.remainingAmount}
                  className="bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/40 border border-emerald-500/30 text-[9px] py-1 px-2.5 rounded-lg font-bold disabled:opacity-30 cursor-pointer active:translate-y-0.5"
                >
                  Settle (${Math.floor(loan.remainingAmount / 1000).toFixed(0)}k)
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
