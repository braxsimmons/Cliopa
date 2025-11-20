interface RequestSummaryProps {
  requestedDays: number;
  currentBalance: number;
  requestType: "PTO" | "UTO";
  timeOffBalance: [any];
}

export const RequestSummary = ({
  requestType,
  timeOffBalance
}: RequestSummaryProps) => {
  const generateOutputs = () => {
    const responseMessages = []
    const warningMessages = []
    const alertMessages = []
    if (timeOffBalance.length > 1) {
      alertMessages.push(multiplePeriods())
    }
    let numDaysRequested = 0;
    let enoughBalance = true;
    for (const period of timeOffBalance) {
      responseMessages.push(periodData(period))
      numDaysRequested += period.days_requested_in_period;
      if (period.days_requested_in_period > period.current_available) {
        enoughBalance = false;
      }
    }
    if (enoughBalance === false) {
      warningMessages.push(exceedBalance())
    }
    if (requestType === "UTO" && numDaysRequested > 3) {
      warningMessages.push(moreThan3Uto())
    }

    return warningMessages.concat(alertMessages, responseMessages)
  }

  const exceedBalance = () => {
    return <div>🛑 Requesting more days than available balance.</div>
  }

  const moreThan3Uto = () => {
    return <div>🛑 Can't request more than 3 days of UTO in a row.</div>
  }

  const multiplePeriods = () => {
    return <div>⚠️ You are requesting time off from multiple periods. This will affect your balance in each period.</div>
  }

  const periodData = (period) => {
    return (
    <div className="mt-1">
      <div className="font-medium">Period: {period.period} | Max Allowed: {period.total_for_period}</div>
      <div>Days Used: {period.total_for_period - (period.current_available + period.current_pending)}</div>
      <div>Requested Days Pending: {period.current_pending}</div>
      <div>Days Available to Request: {period.current_available}</div>
      <div>Days Requested: {period.days_requested_in_period}</div>
      <div>Days Left After Request: {period.current_available - period.days_requested_in_period}</div>
    </div>
    )
  }


  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
      <div className="text-sm">
        {timeOffBalance && generateOutputs()}
      </div>
    </div>
  );
};
