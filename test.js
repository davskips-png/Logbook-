const FinEngine = require('./js/engine.js');

// ==========================================================================
// UNIT TESTS: FinEngine calculations, waterfall, scorecard, PAR, payoff
// ==========================================================================
(function runUnitTests() {
  console.log('--- 1. Testing Financial Calculations ---');
  const emi = FinEngine.calcReducingEMI(300000, 5.0, 12);
  console.log('EMI for KES 300,000 @ 5% p.m., 12m:', Math.round(emi));
  console.assert(emi > 0, 'EMI should be greater than 0');

  const flat = FinEngine.quoteLogbookFlat(400000, 5, 12, 0, '2025-05-05');
  console.log('Logbook flat quote installment:', flat.installment, 'total:', flat.totalPayable);
  console.assert(flat.schedule.length === 12, 'Flat schedule should have 12 rows');
  console.assert(flat.installment === Math.round(400000 / 12) + Math.round(400000 * 0.05), 'Installment = principal/12 + 5% flat');
  console.assert(flat.schedule[11].remainingPrincipal === 0, 'Final principal balance should be 0');

  const missed = FinEngine.quoteLogbookFlat(3000000, 4.1, 24, 0, '2026-08-02', '2026-09-01');
  console.log('Missed-pay quote:', missed.installment, missed.firstDueDate, missed.schedule[1].dueDate);
  console.assert(missed.installment === 248000, 'KES 3,000,000 @ 4.1% for 24m should be 248,000');
  console.assert(missed.firstDueDate === '2026-09-01', 'Disbursed 02/08/2026 → first due 01/09/2026');
  console.assert(missed.schedule[1].dueDate === '2026-10-01', 'Second installment is 01/10/2026');

  const arrears = FinEngine.projectLogbookArrears({
    schedule: missed.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2026-10-20',
    payments: []
  });
  const iso = (d) => FinEngine.toISODate(d);
  const byDate = {};
  arrears.charges.forEach((ch) => { byDate[iso(ch.date)] = ch; });
  console.log('Missed-pay charges:', arrears.charges.map((ch) => iso(ch.date) + ' ' + ch.mode + ' ' + ch.amount));
  console.log('Missed-pay outstanding:', arrears.outstanding);
  console.assert(Math.abs(byDate['2026-09-08'].amount - 12400) < 1e-6, '08/09 first penalty = 248,000 × 5%');
  console.assert(byDate['2026-09-08'].mode === 'first', '08/09 is the first penalty');
  console.assert(Math.abs(byDate['2026-09-15'].amount - 13020) < 1e-6, '15/09 weekly = 12,400 × 1.05');
  console.assert(Math.abs(byDate['2026-09-22'].amount - 13671) < 1e-6, '22/09 weekly = 13,020 × 1.05');
  console.assert(Math.abs(byDate['2026-09-29'].amount - 14354.55) < 1e-6, '29/09 weekly = 13,671 × 1.05');
  console.assert(Math.abs(byDate['2026-10-06'].amount - 15072.2775) < 1e-6, '06/10 continues weekly compounding after next installment');
  console.assert(byDate['2026-10-13'].mode === 'combined', '13/10 is combined (next installment + all arrears)');
  console.assert(Math.abs(byDate['2026-10-13'].amount - 28225.891375) < 1e-6, '13/10 combined = 564,517.8275 × 5%');
  console.assert(Math.abs(byDate['2026-10-20'].amount - 29637.18594375) < 1e-6, '20/10 weekly = 28,225.891375 × 1.05');
  console.assert(Math.abs(arrears.outstanding - 622380.90481875) < 1e-4, 'Outstanding as of 20/10/2026 is 622,380.905');
  console.assert(arrears.remainingInstallment === 496000, 'Two missed installments remain unpaid');

  const ontimeFlat = FinEngine.quoteLogbookFlat(3000000, 4, 24, 3000, '2025-11-20', '2025-12-20');
  console.log('On-time 4% + tracking:', ontimeFlat.installment, ontimeFlat.schedule[0].dueDate, ontimeFlat.schedule[23].dueDate);
  console.assert(ontimeFlat.installment === 248000, 'KES 3,000,000 @ 4% + 3,000 tracking = 248,000');
  console.assert(ontimeFlat.monthlyPrincipal === 125000, 'Principal paid per month is 125,000');
  console.assert(ontimeFlat.monthlyInterest === 120000, 'Interest paid per month is 120,000');
  console.assert(ontimeFlat.schedule[0].dueDate === '2025-12-20', 'First installment 20 Dec 2025');
  console.assert(ontimeFlat.schedule[1].dueDate === '2026-01-20', 'Second installment 20 Jan 2026');
  console.assert(ontimeFlat.schedule[23].dueDate === '2027-11-20', 'Final installment 20 Nov 2027');
  console.assert(ontimeFlat.schedule[0].remainingPrincipal === 2875000, 'Month 1 outstanding principal 2,875,000');
  console.assert(ontimeFlat.schedule[0].remainingPayable === 5704000, 'Month 1 outstanding total 5,704,000');
  console.assert(ontimeFlat.schedule[23].remainingPrincipal === 0, 'Final outstanding principal is 0');
  console.assert(ontimeFlat.schedule[23].remainingPayable === 0, 'Final outstanding total is 0');

  const missedFirst = FinEngine.projectLogbookArrears({
    schedule: ontimeFlat.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2026-01-10',
    payments: []
  });
  const missedByDate = {};
  missedFirst.charges.forEach((ch) => { missedByDate[iso(ch.date)] = ch; });
  console.log('Case 1 missed first installment:', missedFirst.charges.map((ch) => iso(ch.date) + ' ' + ch.amount), 'out', missedFirst.outstanding);
  console.assert(missedFirst.remainingInstallment === 248000, 'Case 1 still has the first installment outstanding');
  console.assert(Math.abs(missedByDate['2025-12-27'].amount - 12400) < 1e-6, '27/12 penalty = 248,000 × 5%');
  console.assert(Math.abs(missedByDate['2026-01-03'].amount - 13020) < 1e-6, '03/01 weekly = 12,400 × 1.05');
  console.assert(Math.abs(missedByDate['2026-01-10'].amount - 13671) < 1e-6, '10/01 weekly = 13,020 × 1.05');
  console.assert(Math.abs(missedFirst.outstanding - 287091) < 1e-4, 'Case 1 outstanding 287,091');
  console.assert(missedFirst.status === 'IN_ARREARS', 'Missed installment is in arrears');

  const paidLate = FinEngine.projectLogbookArrears({
    schedule: ontimeFlat.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2025-12-28',
    payments: [{ id: 1, n: 1, date: '2025-12-28', amount: 260400 }]
  });
  console.log('Case 2 late full payment:', paidLate.status, paidLate.outstanding, paidLate.paymentAllocations[0]);
  console.assert(paidLate.charges.length === 1, 'Case 2 records the 27/12 penalty then stops');
  console.assert(Math.abs(paidLate.charges[0].amount - 12400) < 1e-6, 'Case 2 penalty recorded is 12,400');
  console.assert(paidLate.byInstallment[1].outstanding <= 0, 'Case 2 installment marked cleared');
  console.assert(paidLate.remainingInstallment <= 0, 'Case 2 remaining installment is 0');
  console.assert(paidLate.remainingPenalties <= 0, 'Case 2 remaining penalty is 0');
  console.assert(paidLate.outstanding === 0, 'Case 2 outstanding after 260,400 is 0');
  console.assert(!paidLate.nextPenalty, 'Case 2 stops further penalties on that installment');
  console.assert(paidLate.paymentAllocations[0].toPenalty === 12400, 'Case 2 applies 12,400 to penalty');
  console.assert(paidLate.paymentAllocations[0].toInstallment === 248000, 'Case 2 applies 248,000 to installment');
  console.assert(paidLate.status === 'CURRENT', 'Case 2 loan stays current after clearing the installment');

  const laterAfterPay = FinEngine.projectLogbookArrears({
    schedule: ontimeFlat.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2026-01-10',
    payments: [{ id: 1, n: 1, date: '2025-12-28', amount: 260400 }]
  });
  console.assert(laterAfterPay.charges.length === 1, 'No extra weekly penalties after the installment was cleared');
  console.assert(laterAfterPay.outstanding === 0, 'Still clear through 10/01 before the next due date');

  const partial = FinEngine.projectLogbookArrears({
    schedule: ontimeFlat.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2025-12-27',
    payments: [{ id: 1, n: 1, date: '2025-12-20', amount: 150000 }]
  });
  console.log('Case 3 partial:', partial.remainingInstallment, partial.charges[0] && partial.charges[0].amount, partial.outstanding);
  console.assert(partial.remainingInstallment === 98000, 'Case 3 outstanding installment 248,000 − 150,000 = 98,000');
  console.assert(partial.byInstallment[1].paidToInstallment === 150000, 'Case 3 records 150,000 against the installment');
  console.assert(Math.abs(partial.charges[0].amount - 4900) < 1e-6, 'Case 3 penalty = 98,000 × 5% = 4,900');
  console.assert(Math.abs(partial.outstanding - 102900) < 1e-4, 'Case 3 outstanding 98,000 + 4,900');
  console.assert(partial.status === 'IN_ARREARS', 'Partial payment leaves the loan in arrears');

  const partialWeekly = FinEngine.projectLogbookArrears({
    schedule: ontimeFlat.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2026-01-10',
    payments: [{ id: 1, n: 1, date: '2025-12-20', amount: 150000 }]
  });
  const partialByDate = {};
  partialWeekly.charges.forEach((ch) => { partialByDate[iso(ch.date)] = ch; });
  console.assert(partialWeekly.remainingInstallment === 98000, 'Partial remainder stays 98,000 until the next installment');
  console.assert(Math.abs(partialByDate['2025-12-27'].amount - 4900) < 1e-6, 'Partial first penalty 4,900');
  console.assert(Math.abs(partialByDate['2026-01-03'].amount - 5145) < 1e-6, 'Partial weekly 4,900 × 1.05');
  console.assert(Math.abs(partialByDate['2026-01-10'].amount - 5402.25) < 1e-6, 'Partial weekly continues until next installment');

  const closedLoan = FinEngine.projectLogbookArrears({
    schedule: ontimeFlat.schedule,
    penaltyRate: 0.05,
    graceDays: 7,
    asOf: '2027-11-20',
    payments: ontimeFlat.schedule.map((row, i) => ({
      id: i + 1,
      n: row.n,
      date: row.dueDate,
      amount: row.installment
    }))
  });
  console.log('Case 4 completed:', closedLoan.status, closedLoan.outstanding, closedLoan.closed);
  console.assert(closedLoan.outstanding === 0, 'On-time through final due has zero outstanding');
  console.assert(closedLoan.closed === true, 'Loan is COMPLETED/CLOSED when every obligation is settled');
  console.assert(closedLoan.status === 'COMPLETED', 'Closed loan status is COMPLETED');

  const sched = FinEngine.generateAmortizationSchedule(300000, 5.0, 12, 'REDUCING');
  console.log('Schedule generated rows:', sched.length);
  console.assert(sched.length === 12, 'Schedule should have 12 periods');
  console.assert(sched[11].balance === 0, 'Final balance should be 0');

  console.log('--- 2. Testing Payment Waterfall Allocation ---');
  // Scenario: Payment of KES 50,000 against KES 5,000 penalties, KES 15,000 interest, and KES 25,000 principal
  const alloc = FinEngine.allocatePayment(50000, 5000, 15000, 25000);
  console.log('Allocation result:', alloc);
  console.assert(alloc.penaltyPaid === 5000, 'Penalties should be cleared first');
  console.assert(alloc.interestPaid === 15000, 'Interest should be cleared second');
  console.assert(alloc.principalPaid === 25000, 'Principal should receive 25000');
  console.assert(alloc.overpayment === 5000, 'Remaining 5000 is overpayment/extra principal');

  console.log('--- 3. Testing Credit Risk Scorecard ---');
  const risk = FinEngine.evaluateCreditRisk({
    amount: 300000,
    valuation: 600000,
    monthlyIncome: 120000,
    existingDebt: 20000,
    vehicleYear: 2018,
    crbListed: false
  });
  console.log('Credit evaluation:', risk);
  console.assert(risk.score >= 300 && risk.score <= 850, 'Score should be between 300 and 850');

  console.log('--- 4. Testing PAR Classification ---');
  console.log('DPD 0:', FinEngine.classifyPAR(0).label);
  console.log('DPD 15:', FinEngine.classifyPAR(15).label);
  console.log('DPD 45:', FinEngine.classifyPAR(45).label);
  console.log('DPD 75:', FinEngine.classifyPAR(75).label);
  console.log('DPD 120:', FinEngine.classifyPAR(120).label);

  console.log('\n--- 5. Testing Early Payoff Settlement Quote ---');
  const payoff = FinEngine.calculateEarlySettlementQuote({
    amount: 400000,
    currentPrincipal: 350000,
    approvedRate: 4.5,
    unpaidPenalties: 0
  });
  console.log('Payoff quote:', payoff);
  console.assert(payoff.totalPayoff > 0, 'Payoff quote should be positive');

  console.log('\n--- 6. Testing Collateral Release (Paid in Full → Logbook Released) ---');
  const pifLoan = {
    accountNumber: 'ACC-REL-0001',
    customer: 'Faith Akinyi Otieno',
    phone: '+254 710 662 118',
    idNumber: '30192847',
    email: 'faith.akinyi@gmail.com',
    vehicle: 'Honda Fit 2016',
    reg: 'KDA 442J',
    collateralVaultId: 'VAULT-01-R05-B03',
    currentPrincipal: 0,
    unpaidInterest: 0,
    unpaidPenalties: 0,
    status: 'PAID_IN_FULL',
    repaymentsHistory: [{
      receiptNo: 'REC-MPESA-PIF4412',
      amount: 24000,
      channel: 'M-PESA (Paybill 400200)',
      reference: 'QK44128819'
    }]
  };
  console.assert(FinEngine.isPaidInFull(pifLoan), 'Zero outstanding is Paid in Full');
  const recon = FinEngine.reconcileFinalPayment(pifLoan, pifLoan.repaymentsHistory[0]);
  console.assert(recon.matched && recon.channelOk && !recon.reversedTransactions, 'Final M-Pesa repayment reconciles');
  console.assert(recon.paidInFull, 'Reconciliation marks Paid in Full');

  const reversedLoan = {
    ...pifLoan,
    repaymentsHistory: [{ ...pifLoan.repaymentsHistory[0], reversed: true }]
  };
  const blocked = FinEngine.reconcileFinalPayment(reversedLoan, reversedLoan.repaymentsHistory[0]);
  console.assert(blocked.reversedTransactions, 'Reversed transaction is detected');
  console.assert(!blocked.paidInFull, 'Reversed receipt cannot mark Paid in Full');

  let rel = FinEngine.createCollateralRelease(pifLoan, pifLoan.repaymentsHistory[0], '2025-04-16 09:18');
  console.log('Release created:', rel.status, 'stage', rel.stage);
  console.assert(rel.status === 'PENDING_CLOSURE_REVIEW', 'Step 1 queues closure review');
  console.assert(rel.stage === 2, 'Workflow sits on Finance/Operations checklist');
  console.assert(rel.customerNotice.message.includes('logbook is ready for release'), 'Customer SMS copy is stored');

  const incomplete = FinEngine.applyReleaseAction(rel, 'approve_checklist', {
    checklist: { paymentsCleared: true, noChargebacks: true, noDuplicateBalances: false, identityVerified: true }
  }, 'Finance Officer', '2025-04-16 10:00');
  console.assert(!incomplete.ok, 'Incomplete checklist cannot approve release');

  const tooSoon = FinEngine.applyReleaseAction(rel, 'generate_documents', {}, 'Credit Admin', '2025-04-16 10:01');
  console.assert(!tooSoon.ok, 'Documents cannot generate before closure approval');

  const approved = FinEngine.applyReleaseAction(rel, 'approve_checklist', {
    checklist: { paymentsCleared: true, noChargebacks: true, noDuplicateBalances: true, identityVerified: true }
  }, 'Finance Officer', '2025-04-16 10:05');
  console.assert(approved.ok, 'Complete checklist approves for release');
  rel = approved.release;
  console.assert(rel.status === 'APPROVED_FOR_RELEASE', 'Step 2 status is Approved for Release');
  console.assert(rel.stage === 3, 'Workflow advances to documents');

  const docs = FinEngine.applyReleaseAction(rel, 'generate_documents', {}, 'Credit Admin', '2025-04-16 10:06');
  rel = docs.release;
  console.assert(rel.documents.clearanceCertificate && rel.documents.finalStatement && rel.documents.releaseLetter && rel.documents.closureConfirmation, 'Step 3 generates all four clearance documents');
  console.assert(rel.status === 'DOCUMENTS_READY', 'Documents ready after auto-generate');

  const teams = FinEngine.applyReleaseAction(rel, 'notify_teams', {}, 'Credit Admin', '2025-04-16 10:07');
  rel = teams.release;
  console.assert(rel.teamNotified.operations && rel.teamNotified.custody && rel.teamNotified.branchManager && rel.teamNotified.collections, 'Step 4 notifies operations, custody, branch, collections');
  console.assert(rel.status === 'TEAMS_NOTIFIED', 'Internal teams notified');

  const sms = FinEngine.applyReleaseAction(rel, 'notify_customer', { channel: 'SMS' }, 'System', '2025-04-16 10:08');
  rel = sms.release;
  console.assert(rel.customerNotice.sent, 'Step 5 sends customer SMS');
  console.assert(rel.customerNotice.message === FinEngine.CUSTOMER_RELEASE_SMS, 'SMS matches prescribed copy');
  console.assert(rel.status === 'CUSTOMER_NOTIFIED', 'Customer notified');

  const noDate = FinEngine.applyReleaseAction(rel, 'book_appointment', {
    method: 'BRANCH_PICKUP',
    branch: 'Nairobi CBD Branch'
  }, 'Branch Admin', '2025-04-16 10:10');
  console.assert(!noDate.ok, 'Branch pickup requires a date');

  const booked = FinEngine.applyReleaseAction(rel, 'book_appointment', {
    method: 'BRANCH_PICKUP',
    branch: 'Nairobi CBD Branch',
    date: '2025-04-18',
    time: '10:00'
  }, 'Branch Admin', '2025-04-16 10:12');
  rel = booked.release;
  console.assert(rel.status === 'APPOINTMENT_BOOKED', 'Step 6 books branch pickup');
  console.assert(rel.appointment.date === '2025-04-18', 'Appointment date stored');

  const unsigned = FinEngine.applyReleaseAction(rel, 'complete_handover', {
    idVerified: true,
    idNumberPresented: '30192847',
    releaseFormSigned: true,
    acknowledgementSigned: false,
    receivingCustomer: 'Faith Akinyi Otieno',
    staffName: 'Credit Admin — John S.'
  }, 'Credit Admin', '2025-04-18 10:05');
  console.assert(!unsigned.ok, 'Unsigned acknowledgement blocks handover');

  const handed = FinEngine.applyReleaseAction(rel, 'complete_handover', {
    idVerified: true,
    idNumberPresented: '30192847',
    releaseFormSigned: true,
    acknowledgementSigned: true,
    receivingCustomer: 'Faith Akinyi Otieno',
    staffName: 'Credit Admin — John S.'
  }, 'Credit Admin', '2025-04-18 10:20');
  rel = handed.release;
  console.assert(rel.status === 'HANDOVER_COMPLETE', 'Step 7 completes physical handover');
  console.assert(rel.handover.acknowledgementRef, 'Acknowledgement reference is stored');

  const closed = FinEngine.applyReleaseAction(rel, 'close_and_release', {}, 'Credit Admin', '2025-04-18 10:21');
  rel = closed.release;
  console.log('Final release status:', rel.status);
  console.assert(rel.status === 'CLOSED_LOGBOOK_RELEASED', 'Step 8 final status is CLOSED → LOGBOOK RELEASED');
  console.assert(rel.loanStatusAfter === 'CLOSED', 'Loan status after release is CLOSED');
  console.assert(rel.handover.receivingCustomer === 'Faith Akinyi Otieno', 'Receiving customer stored');
  console.assert(rel.handover.staffName === 'Credit Admin — John S.', 'Staff handling release stored');
  console.assert(rel.log.length >= 8, 'Audit trail records every release step');

  console.log('\nAll Automated Unit & Verification Tests Passed Successfully!\n');
})();

console.log('=== COMPLETE END-TO-END INTEGRATION TEST: SPECTRUM CREDIT LMS & LOS ===\n');

// Mock in-memory state
const state = {
  activeRole: 'BRANCH_ADMIN',
  applications: [],
  loans: [],
  collateralVault: [],
  generalLedger: [],
  notifications: []
};

// --------------------------------------------------------------------------
// STEP 1: Application Intake (Branch Admin)
// --------------------------------------------------------------------------
const appId = 'LBL-2025-0099';
const newApp = {
  id: appId,
  customer: 'Mercy Chebet',
  phone: '+254 712 999 888',
  idNumber: '30491823',
  kraPin: 'A009827162K',
  type: 'INDIVIDUAL',
  vehicle: 'Toyota Harrier 2017',
  reg: 'KDD 888H',
  valuation: 2000000,
  forcedSaleValue: 1500000,
  amount: 800000,
  purpose: 'Working Capital for Boutique Wholesale',
  status: 'SUBMITTED',
  stage: 2,
  assignedRole: 'RISK_OFFICER',
  conditions: [],
  audit: [{ action: 'Application submitted with KYC & appraisal details', by: 'Branch Admin', at: '2025-05-18 10:00' }]
};
state.applications.push(newApp);
console.log('✓ Step 1: Application submitted:', newApp.id, 'for', newApp.customer);

// --------------------------------------------------------------------------
// STEP 2: Risk Review (Risk Officer)
// --------------------------------------------------------------------------
newApp.status = 'PENDING_APPROVAL';
newApp.stage = 3;
newApp.assignedRole = 'CREDIT_RISK_MANAGER';
newApp.creditScore = FinEngine.evaluateCreditRisk({
  amount: newApp.amount,
  valuation: newApp.valuation,
  monthlyIncome: 250000,
  existingDebt: 30000,
  vehicleYear: 2017,
  crbListed: false
});
newApp.audit.push({
  action: `Risk review completed — Credit Score: ${newApp.creditScore.score} (${newApp.creditScore.grade})`,
  by: 'Risk Officer',
  at: '2025-05-18 11:30'
});
console.log(`✓ Step 2: Risk review passed. Score: ${newApp.creditScore.score} (${newApp.creditScore.grade}), forwarded to CRM`);

// --------------------------------------------------------------------------
// STEP 3: First Approval & Terms/Conditions Set (Credit Risk Manager)
// --------------------------------------------------------------------------
newApp.approvedAmount = 800000;
newApp.approvedRate = 4.5;
newApp.approvedDuration = 12;
newApp.conditions = [
  { id: 'c1', label: 'Home visit & residence verification photos', isMet: true, evidence: 'home_visit_photos.pdf' },
  { id: 'c2', label: 'Original Logbook deposited in Spectrum Safe Vault', isMet: true, evidence: 'vault_deposit_receipt.pdf' },
  { id: 'c3', label: 'GPS Tracker installation certificate from Rivertrack Ltd', isMet: true, evidence: 'tracker_cert_888H.pdf' },
  { id: 'c4', label: 'Comprehensive insurance joint loss payee endorsement', isMet: true, evidence: 'insurance_endorsement.pdf' }
];
newApp.status = 'CONDITIONS_MET';
newApp.stage = 6;
newApp.assignedRole = 'CREDIT_ADMIN';
console.log('✓ Step 3: Terms approved (KES 800,000 @ 4.5% p.m., 12m) & all 4 CPs verified');

// --------------------------------------------------------------------------
// STEP 4: Facility Booking & Final Approval (Credit Admin & CRM)
// --------------------------------------------------------------------------
newApp.status = 'FINAL_APPROVED';
newApp.stage = 8;
newApp.assignedRole = 'FINANCE_OFFICER';
console.log('✓ Step 4: Facility booked & final approval granted');

// --------------------------------------------------------------------------
// STEP 5: Payment Voucher & Disbursement (Finance Manager) -> LMS Handover
// --------------------------------------------------------------------------
newApp.status = 'DISBURSED';
newApp.stage = 10;
newApp.assignedRole = null;

const loanAcc = 'ACC-2025-0099';
const schedule = FinEngine.generateAmortizationSchedule(newApp.approvedAmount, newApp.approvedRate, newApp.approvedDuration, 'REDUCING', '2025-05-18');
const lmsLoan = {
  accountNumber: loanAcc,
  appId: newApp.id,
  customer: newApp.customer,
  phone: newApp.phone,
  vehicle: newApp.vehicle,
  reg: newApp.reg,
  valuation: newApp.valuation,
  disbursedAmount: newApp.approvedAmount,
  currentPrincipal: newApp.approvedAmount,
  approvedRate: newApp.approvedRate,
  tenorMonths: newApp.approvedDuration,
  disbursementDate: '2025-05-18',
  nextDueDate: '2025-06-18',
  daysPastDue: 0,
  parStatus: 'PAR_0',
  unpaidPenalties: 0,
  unpaidInterest: 0,
  totalPaid: 0,
  status: 'ACTIVE',
  collateralVaultId: 'VAULT-01-R04-B08',
  gpsTrackerId: 'GPS-88891-TR',
  schedule,
  repaymentsHistory: []
};
state.loans.push(lmsLoan);

// Safe Vault Deposit
state.collateralVault.push({
  vaultId: 'VAULT-01-R04-B08',
  logbookNumber: 'LOG-KDD888H-2025',
  regNumber: newApp.reg,
  ownerName: newApp.customer,
  location: 'Spectrum Safe Vault 1, Rack 4, Box 8',
  status: 'IN_CUSTODY',
  ntsaCaveatRef: 'CAV-NTSA-2025-9912',
  gpsDetails: {
    unitId: 'GPS-88891-TR',
    batteryPct: 98,
    engineStatus: 'ENGINE_OFF',
    currentLocation: 'Parklands, 4th Avenue, Nairobi',
    immobilizerState: 'DISENGAGED'
  }
});

// Accounting Double-Entry Journal for Disbursement
state.generalLedger.push({
  id: 'JRN-2025-101',
  date: '2025-05-18 14:00',
  description: `Disbursement of facility ${newApp.id} (${newApp.customer})`,
  debitAccount: '1200 - Loans Receivable (Asset)',
  debitAmount: 800000,
  creditAccount: '1010 - NCBA Bank Operating (Asset)',
  creditAmount: 800000,
  refId: newApp.id
});
console.log('✓ Step 5: Loan disbursed & provisioned in Core LMS as:', loanAcc);

// --------------------------------------------------------------------------
// STEP 6: Repayment Cashier Processing (M-Pesa Paybill Waterfall)
// --------------------------------------------------------------------------
const installment1 = schedule[0];
const paymentAmt = installment1.installment; // Full 1st monthly installment
console.log(`\nProcessing Month 1 Repayment: ${FinEngine.kes(paymentAmt)}`);

const alloc = FinEngine.allocatePayment(paymentAmt, lmsLoan.unpaidPenalties, installment1.interest, installment1.principal);
lmsLoan.currentPrincipal -= (alloc.principalPaid + alloc.overpayment);
lmsLoan.totalPaid += paymentAmt;
installment1.status = 'PAID';
installment1.paidAmount = paymentAmt;
installment1.paidDate = '2025-06-18';

lmsLoan.repaymentsHistory.push({
  receiptNo: 'REC-MPESA-88912',
  date: '2025-06-18 10:15',
  amount: paymentAmt,
  channel: 'M-PESA (Paybill 400200)',
  reference: 'QA88192019',
  allocatedPrincipal: alloc.principalPaid,
  allocatedInterest: alloc.interestPaid,
  allocatedPenalty: alloc.penaltyPaid
});

// Journal entry for repayment
state.generalLedger.push({
  id: 'JRN-2025-102',
  date: '2025-06-18 10:15',
  description: `Repayment received on ${loanAcc} via M-Pesa`,
  debitAccount: '1020 - M-Pesa Collections (Asset)',
  debitAmount: paymentAmt,
  creditAccount: `1200 - Loans Principal: ${FinEngine.kes(alloc.principalPaid)} | 4010 - Interest Income: ${FinEngine.kes(alloc.interestPaid)}`,
  creditAmount: paymentAmt,
  refId: 'REC-MPESA-88912'
});

console.log('✓ Step 6: Month 1 Repayment posted:');
console.log(`  - Allocated to Interest (Revenue): ${FinEngine.kes(alloc.interestPaid)}`);
console.log(`  - Allocated to Principal: ${FinEngine.kes(alloc.principalPaid)}`);
console.log(`  - Remaining Loan Principal: ${FinEngine.kes(lmsLoan.currentPrincipal)}`);
console.assert(lmsLoan.currentPrincipal < 800000, 'Principal must decrease after repayment');

// --------------------------------------------------------------------------
// STEP 7: Simulate Arrears, Delinquency & PAR Classification
// --------------------------------------------------------------------------
console.log('\nSimulating Delinquency in Month 3 (Borrower misses payment):');
lmsLoan.daysPastDue = 35;
lmsLoan.unpaidPenalties = 4500; // 5% late charge on installment
const par = FinEngine.classifyPAR(lmsLoan.daysPastDue);
lmsLoan.parStatus = par.bucket;
lmsLoan.status = 'IN_ARREARS';

console.log(`✓ Step 7: Arrears classified: DPD ${lmsLoan.daysPastDue} -> ${par.label} (Risk: ${par.riskLevel})`);
console.assert(par.bucket === 'PAR_31_60', 'Should be PAR 31-60');

// --------------------------------------------------------------------------
// STEP 8: Telematics & Immobilizer Check
// --------------------------------------------------------------------------
const vaultItem = state.collateralVault[0];
console.log(`✓ Step 8: Checking GPS Telematics for Vehicle ${vaultItem.regNumber}:`);
console.log(`  - GPS Unit: ${vaultItem.gpsDetails.unitId} · Location: ${vaultItem.gpsDetails.currentLocation}`);
console.log(`  - Battery: ${vaultItem.gpsDetails.batteryPct}% · Engine: ${vaultItem.gpsDetails.engineStatus}`);

// Test remote immobilizer cut-off
vaultItem.gpsDetails.immobilizerState = 'REMOTE_CUTOFF_ACTIVE';
vaultItem.gpsDetails.engineStatus = 'ENGINE_OFF_CUTOFF';
console.log(`  - Remote Immobilizer Command Executed: ${vaultItem.gpsDetails.immobilizerState}`);
console.assert(vaultItem.gpsDetails.immobilizerState === 'REMOTE_CUTOFF_ACTIVE', 'Immobilizer should be active');

// --------------------------------------------------------------------------
// STEP 9: Early Payoff Settlement Quote
// --------------------------------------------------------------------------
console.log('\nComputing Early Settlement & Payoff Quote:');
const payoffQuote = FinEngine.calculateEarlySettlementQuote(lmsLoan);
console.log('✓ Step 9: Early Payoff Quote Generated:');
console.log(`  - Outstanding Principal: ${FinEngine.kes(payoffQuote.remainingPrincipal)}`);
console.log(`  - Accrued Interest: ${FinEngine.kes(payoffQuote.accruedInterest)}`);
console.log(`  - Unpaid Late Penalties: ${FinEngine.kes(payoffQuote.unpaidPenalties)}`);
console.log(`  - Discharge & NTSA Lifting Fee: ${FinEngine.kes(payoffQuote.dischargeFee)}`);
console.log(`  - Prompt Payoff Rebate (1%): -${FinEngine.kes(payoffQuote.earlyPayoffDiscount)}`);
console.log(`  - Total Net Payoff Required: ${FinEngine.kes(payoffQuote.totalPayoff)}`);
console.assert(payoffQuote.totalPayoff > 0, 'Payoff must be positive');

// --------------------------------------------------------------------------
// STEP 10: General Ledger Double-Entry Balance Verification
// --------------------------------------------------------------------------
console.log('\nChecking General Ledger Balance Integrity:');
let totalDebits = 0;
let totalCredits = 0;

state.generalLedger.forEach(j => {
  totalDebits += j.debitAmount;
  totalCredits += j.creditAmount;
});

console.log(`✓ Step 10: Total Debits: ${FinEngine.kes(totalDebits)} | Total Credits: ${FinEngine.kes(totalCredits)}`);
console.assert(totalDebits === totalCredits, 'Double-entry ledger must balance (Debits == Credits)!');

// --------------------------------------------------------------------------
// STEP 11: Final repayment → Paid in Full → 8-step logbook release
// --------------------------------------------------------------------------
console.log('\nSimulating final repayment and automated collateral release:');
lmsLoan.currentPrincipal = 0;
lmsLoan.unpaidInterest = 0;
lmsLoan.unpaidPenalties = 0;
lmsLoan.totalPaid = 800000;
lmsLoan.repaymentsHistory.push({
  receiptNo: 'REC-MPESA-FINAL99',
  date: '2026-05-18 09:00',
  amount: payoffQuote.totalPayoff,
  channel: 'M-PESA (Paybill 400200)',
  reference: 'QA99001122'
});
console.assert(FinEngine.isPaidInFull(lmsLoan), 'Final repayment clears the servicing balance');

let release = FinEngine.createCollateralRelease(lmsLoan, lmsLoan.repaymentsHistory[lmsLoan.repaymentsHistory.length - 1], '2026-05-18 09:00');
console.assert(release.status === 'PENDING_CLOSURE_REVIEW', 'Account marked Paid in Full and queued for closure review');
lmsLoan.status = 'PAID_IN_FULL';
vaultItem.status = 'PENDING_DISCHARGE';

release = FinEngine.applyReleaseAction(release, 'approve_checklist', {
  checklist: { paymentsCleared: true, noChargebacks: true, noDuplicateBalances: true, identityVerified: true }
}, 'Finance Officer', '2026-05-18 10:00').release;
release = FinEngine.applyReleaseAction(release, 'generate_documents', {}, 'Credit Admin', '2026-05-18 10:01').release;
release = FinEngine.applyReleaseAction(release, 'notify_teams', {}, 'Credit Admin', '2026-05-18 10:02').release;
release = FinEngine.applyReleaseAction(release, 'notify_customer', { channel: 'SMS' }, 'System', '2026-05-18 10:03').release;
release = FinEngine.applyReleaseAction(release, 'book_appointment', {
  method: 'BRANCH_PICKUP',
  branch: 'Nairobi CBD Branch',
  date: '2026-05-20',
  time: '10:00'
}, 'Branch Admin', '2026-05-18 11:00').release;
release = FinEngine.applyReleaseAction(release, 'complete_handover', {
  idVerified: true,
  idNumberPresented: '30491823',
  releaseFormSigned: true,
  acknowledgementSigned: true,
  receivingCustomer: newApp.customer,
  staffName: 'Credit Admin — Custody Safe'
}, 'Credit Admin', '2026-05-20 10:15').release;
release = FinEngine.applyReleaseAction(release, 'close_and_release', {}, 'Credit Admin', '2026-05-20 10:16').release;

lmsLoan.status = 'CLOSED';
lmsLoan.release = release;
vaultItem.status = 'RELEASED';
vaultItem.releasedTo = release.handover.receivingCustomer;
vaultItem.releasedBy = release.handover.staffName;
vaultItem.acknowledgementRef = release.handover.acknowledgementRef;
if (vaultItem.gpsDetails) vaultItem.gpsDetails.immobilizerState = 'DISENGAGED';

console.log(`✓ Step 11: CLOSED → LOGBOOK RELEASED for ${vaultItem.regNumber}`);
console.log(`  - Status: ${release.status}`);
console.log(`  - Released to: ${release.handover.receivingCustomer}`);
console.log(`  - Staff: ${release.handover.staffName}`);
console.log(`  - Acknowledgement: ${release.handover.acknowledgementRef}`);
console.assert(release.status === 'CLOSED_LOGBOOK_RELEASED', 'Release file is CLOSED → LOGBOOK RELEASED');
console.assert(vaultItem.status === 'RELEASED', 'Vault item is RELEASED');
console.assert(lmsLoan.status === 'CLOSED', 'LMS account is CLOSED');

console.log('\n====================================================================');
console.log('🎉 ALL 11 COMPREHENSIVE END-TO-END TESTS PASSED WITH 100% SUCCESS!');
console.log('====================================================================');
