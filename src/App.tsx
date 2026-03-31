import './App.css'

function App() {
  return (
    <div className="app">
      <div className="hero">
        <div className="hero-glow" />
        <h1 className="hero-title">
          Welcome to <span className="gradient-text">Your App</span>
        </h1>
        <p className="hero-subtitle">
          Built with Vite, React 19, and TypeScript. Start editing <code>src/App.tsx</code> to build something amazing.
        </p>
        <div className="hero-actions">
          <a className="btn btn-primary" href="https://react.dev" target="_blank" rel="noreferrer">
            React Docs
          </a>
          <a className="btn btn-secondary" href="https://vite.dev" target="_blank" rel="noreferrer">
            Vite Docs
          </a>
        </div>
      </div>
    </div>
  )
}

export default App
