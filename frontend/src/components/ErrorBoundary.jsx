import React from 'react';

// Component tree дотор render/lifecycle үед garsan алдааг барьж, цагаан
// хуудас болохоос сэргийлнэ. Заавал class component байх ёстой (React-д
// error boundary hook хэлбэрээр байдаггүй). Аль болох бага dependency-тэй
// байлгасан — өөрөө i18n/context-оос хамаарвал тэдгээр нь эвдэрсэн ч энэ
// fallback ажиллахгүй эрсдэлтэй.
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error caught by ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '24px',
          textAlign: 'center', fontFamily: 'system-ui, sans-serif',
        }}>
          <h1 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Something went wrong</h1>
          <p style={{ color: '#666', marginBottom: '20px' }}>
            Please reload the page. If the problem continues, contact support.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px', borderRadius: '8px', border: 'none',
              background: '#111', color: '#fff', cursor: 'pointer', fontSize: '1rem',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
