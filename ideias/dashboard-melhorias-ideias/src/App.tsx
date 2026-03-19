function App() {
  const dashboards = [
    {
      id: 1,
      title: 'Gauges Circulares',
      description: 'Dashboard com gauges circulares animados para cotação, prêmio, distância do strike e tempo restante',
      color: 'from-cyan-500 to-blue-500',
      icon: '📊',
      features: ['Gauges animados', 'PoP (Probabilidade)', 'Tempo Real', 'Recomendações']
    },
    {
      id: 2,
      title: 'Análise Avançada',
      description: 'Métricas com barras de progresso, gregas (Delta, Theta, Gamma, Vega) e recomendações',
      color: 'from-emerald-500 to-teal-500',
      icon: '⚡',
      features: ['Gregas completas', 'Barras de progresso', 'Timeline', 'Análise de risco']
    },
    {
      id: 3,
      title: 'Radar de Oportunidades',
      description: 'Score de operações, ranking de oportunidades e comparativo de ativos para abertura',
      color: 'from-orange-500 to-red-500',
      icon: '🎯',
      features: ['Radar de oportunidades', 'Ranking', 'Score 0-10', 'Tabela comparativa']
    },
    {
      id: 4,
      title: 'Análise Temporal',
      description: 'Linha do tempo, countdown, evolução do lucro e projeções de cenários',
      color: 'from-indigo-500 to-violet-500',
      icon: '⏱️',
      features: ['Timeline visual', 'Countdown', 'Projeções', 'Decaimento Theta']
    },
    {
      id: 5,
      title: 'Comparativo de Estratégias',
      description: 'Compare Manter vs Fechar vs Rolagem com matriz de decisão e prós/contras',
      color: 'from-pink-500 to-rose-500',
      icon: '⚖️',
      features: ['3 estratégias', 'Matriz decisão', 'Prós e contras', 'Tabela comparativa']
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center text-2xl">
              📈
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Trading Pro Dashboard</h1>
              <p className="text-gray-400 text-sm">Sistema de Análise de Opções e Crypto</p>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            5 Dashboards para Análise de Trading
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Explore diferentes visualizações para análise de opções e crypto. 
            Cada versão oferece métricas essenciais como PoP, Theta, Strike, Prêmio e muito mais.
          </p>
        </div>

        {/* Dashboard Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {dashboards.map((dashboard) => (
            <a
              key={dashboard.id}
              href={`index${dashboard.id}.html`}
              className="group relative bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-white/20 transition-all duration-300 hover:transform hover:scale-[1.02]"
            >
              {/* Gradient overlay */}
              <div className={`absolute inset-0 bg-gradient-to-br ${dashboard.color} opacity-5 group-hover:opacity-10 transition-opacity`}></div>
              
              <div className="relative p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 bg-gradient-to-br ${dashboard.color} rounded-xl flex items-center justify-center text-2xl shadow-lg`}>
                    {dashboard.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-white">{dashboard.title}</h3>
                      <span className="px-2 py-1 bg-white/10 rounded-full text-xs text-gray-300">
                        Versão {dashboard.id}
                      </span>
                    </div>
                    <p className="text-gray-400 mb-4">{dashboard.description}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {dashboard.features.map((feature, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-gray-300"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-500 text-sm">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Disponível
                  </div>
                  <div className="flex items-center gap-2 text-white group-hover:text-teal-400 transition-colors">
                    <span className="text-sm font-medium">Visualizar</span>
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Features Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              📊
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Métricas Essenciais</h3>
            <p className="text-gray-400 text-sm">
              PoP, Theta, Delta, Strike, Prêmio, Distância OTM/ITM e muito mais
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              🎯
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Tomada de Decisão</h3>
            <p className="text-gray-400 text-sm">
              Recomendações inteligentes: Manter, Fechar ou Rolar posições
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              ⚡
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Tempo Real</h3>
            <p className="text-gray-400 text-sm">
              Atualizações em tempo real com gauges, gráficos e countdown
            </p>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mt-16">
          <h3 className="text-2xl font-bold text-white text-center mb-8">Comparativo das Versões</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 px-4 text-gray-400 font-medium">Característica</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">V1</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">V2</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">V3</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">V4</th>
                  <th className="text-center py-4 px-4 text-gray-400 font-medium">V5</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-white/5">
                  <td className="py-4 px-4 text-gray-300">Gauges Circulares</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-4 text-gray-300">Gregas (Delta, Theta, Gamma, Vega)</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-4 text-gray-300">Radar de Oportunidades</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-4 text-gray-300">Timeline/Countdown</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-4 text-gray-300">Comparativo de Estratégias</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-gray-500">—</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                </tr>
                <tr className="border-b border-white/5">
                  <td className="py-4 px-4 text-gray-300">PoP (Probabilidade)</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 text-gray-300">Recomendações</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                  <td className="py-4 px-4 text-center text-green-400">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                📈
              </div>
              <span className="text-gray-400 text-sm">Trading Pro Dashboard</span>
            </div>
            <p className="text-gray-500 text-sm">
              5 dashboards profissionais para análise de opções e crypto
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
