// Pure attendance decision engine — implements the HRM Attendance Logic spec exactly:
//
//   IF No Check-In                              -> ABSENT / NO_CHECK_IN
//   ELSE IF No Check-Out                        -> ABSENT / MISSING_CHECK_OUT   (never auto-computed to "now")
//   ELSE
//       creditedMinutes = actual minutesWorked + permissionAdjustmentMinutes   (Permission Mgmt spec §15)
//       IF Approved Half-Day Leave
//           IF creditedMinutes >= Half-Day Hours  -> HALF_DAY / {FIRST,SECOND}_HALF_LEAVE
//           ELSE                                   -> ABSENT / INSUFFICIENT_HALF_DAY_HOURS
//       ELSE
//           IF creditedMinutes >= Required Hours   -> PRESENT / NORMAL
//           ELSE                                    -> ABSENT / INSUFFICIENT_WORKING_HOURS
//
// Half-day minutes are always derived as requiredMinutes / 2 — never hard-coded or stored separately.
// permissionAdjustmentMinutes defaults to 0 (no permission on record), which makes creditedMinutes
// identical to minutesWorked — i.e. this is a strict extension, not a behavior change.

export function halfDayMinutesFor(requiredMinutes) {
  return Math.round(requiredMinutes / 2);
}

// approvedHalf: null | 'FIRST_HALF' | 'SECOND_HALF'
// permissionAdjustmentMinutes: signed minutes from approved Short/Late/Early-Exit permissions that
// policy says should count as working time — positive credits (Late/Early-Exit shortfall made up),
// negative debits (Short Permission gap subtracted out when it does NOT count as working time).
export function computeAttendance({ checkIn, checkOut, shift, approvedHalf = null, permissionAdjustmentMinutes = 0 }) {
  if (!checkIn) {
    return { status: 'ABSENT', reason: 'NO_CHECK_IN', minutesWorked: null };
  }
  if (!checkOut) {
    return { status: 'ABSENT', reason: 'MISSING_CHECK_OUT', minutesWorked: null };
  }

  let minutesWorked = Math.round((new Date(checkOut) - new Date(checkIn)) / 60000);
  if (shift.breakPolicy === 'EXCLUDE_FROM_WORK') {
    minutesWorked = Math.max(0, minutesWorked - shift.breakMinutes);
  }

  const creditedMinutes = Math.max(0, minutesWorked + permissionAdjustmentMinutes);

  if (approvedHalf) {
    const required = halfDayMinutesFor(shift.requiredMinutes);
    if (creditedMinutes >= required) {
      return {
        status: 'HALF_DAY',
        reason: approvedHalf === 'FIRST_HALF' ? 'FIRST_HALF_LEAVE' : 'SECOND_HALF_LEAVE',
        minutesWorked,
        creditedMinutes
      };
    }
    return { status: 'ABSENT', reason: 'INSUFFICIENT_HALF_DAY_HOURS', minutesWorked, creditedMinutes };
  }

  if (creditedMinutes >= shift.requiredMinutes) {
    return { status: 'PRESENT', reason: 'NORMAL', minutesWorked, creditedMinutes };
  }
  return { status: 'ABSENT', reason: 'INSUFFICIENT_WORKING_HOURS', minutesWorked, creditedMinutes };
}
