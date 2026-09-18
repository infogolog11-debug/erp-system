// حسابات الأسطول — كفاءة الوقود، تكلفة الكيلومتر، استحقاق الصيانة

export function fuelEfficiency(litersUsed: number, kmDriven: number): number {
  // لتر/100كم — كلما قلّ الرقم كانت الكفاءة أعلى
  if (kmDriven <= 0) return 0;
  return (litersUsed / kmDriven) * 100;
}

export function costPerKm(totalCost: number, kmDriven: number): number {
  if (kmDriven <= 0) return 0;
  return totalCost / kmDriven;
}

export function isMaintenanceDue(
  currentOdometer: number,
  nextServiceOdometer: number | null,
  nextServiceDate: Date | null,
  today: Date = new Date(),
): boolean {
  const odometerDue = nextServiceOdometer != null && currentOdometer >= nextServiceOdometer;
  const dateDue = nextServiceDate != null && today >= nextServiceDate;
  return odometerDue || dateDue;
}

export function isLicenseExpiringSoon(
  licenseExpiryDate: Date | null,
  today: Date = new Date(),
  warningDays: number = 30,
): boolean {
  if (!licenseExpiryDate) return false;
  const diffMs = licenseExpiryDate.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= warningDays;
}

export function tripDistance(startOdometer: number, endOdometer: number | null): number {
  if (endOdometer == null || endOdometer < startOdometer) return 0;
  return endOdometer - startOdometer;
}
