// Constructed only from the numeric test contract; no private input files are read.
export function syntheticFixture() {
  const asOf = '2026-10-20';
  const days = Array.from({ length: 44 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 7, 11 + index)).toISOString().slice(0, 10),
    open: 1,
    close: 1,
  }));
  days[43].date = '2026-10-19';
  for (const day of days) {
    if (['2026-08-11', '2026-09-02', '2026-09-16'].includes(day.date)) day.close = 0;
    if (day.date === '2026-10-19') day.close = null;
  }
  const texts = [
    '상대의 질문을 차분히 설명했다.',
    '계획을 메모하고 마무리했다.',
    '부족한 부분을 배우고 확인했다.',
    '상대의 부탁을 듣고 설명했다.',
    '시간 계획을 정리했다.',
    '부족한 부분을 노력해 해결했다.',
    '계획을 세우고 마무리했다.',
  ];
  return {
    rituals: {
      asOf,
      days,
      screenTotals: { days: 44, open: 44, close: 43 },
      evidence: texts.map((text, index) => ({
        date: `2026-08-${String(12 + index).padStart(2, '0')}`,
        kind: 'close',
        sourceField: '합성 테스트 근거',
        text,
      })),
    },
    attendance: {
      asOf,
      start: '2026-08-11',
      end: asOf,
      trainingDays: 46,
      enrolledDays: 46,
      presentDays: 45,
      absentDays: 0,
      pendingDays: 1,
      rateNumerator: 45,
      displayedPercent: 97.8,
    },
    projects: {
      asOf,
      submissions: [
        ...Array.from({ length: 11 }, (_, index) => ({
          id: `T${String(index + 1).padStart(2, '0')}`,
          submittedAt: `2026-09-${String(2 + index).padStart(2, '0')}T12:00:00+09:00`,
        })),
        { id: 'T11', submittedAt: '2026-10-19T12:00:00+09:00' },
      ],
      screenTotals: { rows: 12, tasks: 11 },
    },
    approvals: { asOf, approvedCandidateIds: [] },
  };
}
