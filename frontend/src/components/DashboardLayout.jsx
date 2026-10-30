import { useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'

export default function DashboardLayout({ children, title, subtitle, stats = [] }) {
  const { setPageInfo } = useOutletContext()

  useEffect(() => {
    setPageInfo(prev => {
      // Avoid infinite loops by only updating if there's a difference
      if (
        prev.title !== title || 
        prev.subtitle !== subtitle || 
        JSON.stringify(prev.stats) !== JSON.stringify(stats)
      ) {
        return { title: title || '', subtitle: subtitle || '', stats: stats || [] }
      }
      return prev
    })
  }, [title, subtitle, stats, setPageInfo])

  return <>{children}</>
}
