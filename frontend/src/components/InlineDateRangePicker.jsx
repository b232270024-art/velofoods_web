import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function InlineDateRangePicker({ startDate, endDate, onSelectRange, minDate }) {
  // Start with the month of minDate or today
  const initDate = minDate ? new Date(minDate) : new Date();
  const [currentMonth, setCurrentMonth] = useState(new Date(initDate.getFullYear(), initDate.getMonth(), 1));

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Convert so Monday is 0
    const startOffset = (firstDay + 6) % 7; 
    
    const arr = [];
    for (let i = 0; i < startOffset; i++) {
      arr.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(Date.UTC(year, month, i));
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, [currentMonth]);

  const handleDayClick = (dateStr) => {
    if (minDate && dateStr < minDate) return;

    if (!startDate || (startDate && endDate)) {
      onSelectRange(dateStr, '');
    } else {
      if (dateStr < startDate) {
        onSelectRange(dateStr, '');
      } else {
        onSelectRange(startDate, dateStr);
      }
    }
  };

  return (
    <div className="card" style={{ padding: '20px 24px', background: 'var(--bg-card)', marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-dark)', fontFamily: 'Outfit, sans-serif' }}>
          Select Delivery Dates
        </h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}...` : 'Choose your dates'}
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={handlePrevMonth} style={{ padding: 6, background: 'var(--bg-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-dark)' }}>
          {MONTH_NAMES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </span>
        <button onClick={handleNextMonth} style={{ padding: 6, background: 'var(--bg-muted)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center', marginBottom: 8 }}>
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {days.map((dateStr, idx) => {
          if (!dateStr) return <div key={idx} />;
          const dayNum = parseInt(dateStr.slice(8, 10), 10);
          
          const isBeforeMin = minDate && dateStr < minDate;
          const isStart = dateStr === startDate;
          const isEnd = dateStr === endDate;
          const isBetween = startDate && endDate && dateStr > startDate && dateStr < endDate;
          const isSelected = isStart || isEnd || isBetween;

          let bg = 'transparent';
          let color = 'var(--text-body)';
          let borderRadius = 8;
          let fw = 500;

          if (isBeforeMin) {
            color = 'var(--text-muted)';
            bg = 'transparent';
          } else if (isStart || isEnd) {
            bg = 'var(--brand-green)';
            color = '#fff';
            fw = 800;
            // Round only the outer edges of the selection
            if (isStart && endDate) borderRadius = '8px 0 0 8px';
            if (isEnd && startDate) borderRadius = '0 8px 8px 0';
            if (isStart && !endDate) borderRadius = 8;
            if (isStart && isEnd) borderRadius = 8;
          } else if (isBetween) {
            bg = 'var(--brand-green-light)'; // We'll need to define this or use rgba
            color = 'var(--text-dark)';
            borderRadius = 0;
            fw = 700;
          }

          const inlineStyle = {
            padding: '10px 0',
            fontSize: '0.85rem',
            fontWeight: fw,
            cursor: isBeforeMin ? 'not-allowed' : 'pointer',
            background: isBetween ? 'rgba(16, 185, 129, 0.15)' : bg,
            color,
            borderRadius,
            transition: 'all 0.2s ease',
            border: 'none',
            outline: 'none',
          };

          return (
            <button
              key={dateStr}
              disabled={isBeforeMin}
              onClick={() => handleDayClick(dateStr)}
              style={inlineStyle}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}
