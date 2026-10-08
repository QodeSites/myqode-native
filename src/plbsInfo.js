// How each figure on the Reports page's summary tiles is arrived at, in plain words for investors who are not
// finance people: the ⓘ beside each tile on the web (src/web/reports.js) and the tap-to-read note on the phone
// (src/screens/reports.js). One wording for both.

// Transactions (myQode lib/reportsData.ts transactionsReport)
export const TXN_INFO = {
  moneyIn: 'The total amount received into the portfolio during the selected period, including additional investments and securities transferred in.',
  moneyOut: 'The total funds and securities withdrawn or transferred out of the portfolio during the selected period.',
  income: 'Income earned by the portfolio during the selected period through dividends and interest on investments and cash holdings.',
  fees: 'The total charges deducted from the portfolio during the selected period, including management, custody, brokerage and other transaction-related fees.',
  switches: 'Money moved into this account from your other Qode accounts (a switch), less any moved out to them, during the selected period. It is your own money changing strategy, so it is shown apart from Money in; together with Money in and Money out it makes up the amount invested.',
};
// Capital gains (lib/reportsData.ts capitalGainsReport; unrealised from lib/securities.ts)
export const CG_INFO = {
  st: 'The realised gain or loss on investments sold within the short-term holding period, based on the difference between the sale value and the cost of investment.',
  lt: 'The realised gain or loss on investments sold after being held for the long-term holding period, based on the difference between the sale value and the cost of investment.',
  realised: 'The total gain or loss realised from investments sold during the selected period, including both short-term and long-term gains or losses. It is based on the difference between the sale value and the cost of investment.',
  unrealised: 'The total gain or loss on investments that you still hold, based on the difference between their current market value and cost of investment. The gain or loss is not realised until the investment is sold.',
};
// Expenses (lib/reportsData.ts expensesReport)
export const EXP_INFO = {
  paid: 'The total charges already deducted from the account during the selected period, including management and custody fees, brokerage, STT and other transaction-related charges.',
  payable: 'The total charges accrued during the selected period but not yet deducted from the account, including fees and other charges payable to date.',
  total: 'The total charges for the selected period, including both charges already paid and charges accrued but not yet deducted from the account.',
};
// Fact sheet (lib/reportsData.ts factsheetReport, lib/factsheetCompute.ts)
export const FS_INFO = {
  value: 'The current market value of investments held in the portfolio as of the reporting date.',
  pl: 'The overall gain or loss on the portfolio since the investment began, based on the current portfolio value and net cash flows.',
  contribution: 'The total amount invested in the portfolio since the account was started, including any additional investments made over time.',
  withdrawal: 'The total amount withdrawn from the portfolio since the account was opened.',
};
// Profit and Loss Account - Balance Sheet (myQode lib/plbsCompute.ts)
export const PLBS_INFO = {
  income: 'The total income earned by the portfolio during the selected period, including dividends, interest and realised gains or losses from investments.',
  expenses: 'The total charges incurred by the portfolio during the selected period, including management, custody, brokerage, STT and other transaction-related expenses.',
  surplus: 'The net profit or loss realised during the selected period, calculated as total income less total expenses. Unrealised gains or losses are excluded.',
  unrealised: 'The net gain or loss on investments that remain unsold during the selected period, based on changes in their market value.',
  value: 'The total current market value of the assets held in the portfolio as of the reporting date.',
};
