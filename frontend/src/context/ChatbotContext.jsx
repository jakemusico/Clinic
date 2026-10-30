import { createContext, useContext, useState } from 'react'

const ChatbotContext = createContext()

export function ChatbotProvider({ children }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [chatRole, setChatRole] = useState(null) // 'nurse' | 'dentist' | null

  const openLiveChat = (role) => {
    setChatRole(role)
    setOpen(true)
  }

  const openFaq = () => {
    setChatRole(null)
    setOpen(true)
  }

  return (
    <ChatbotContext.Provider
      value={{
        open,
        setOpen,
        messages,
        setMessages,
        chatRole,
        setChatRole,
        openLiveChat,
        openFaq,
      }}
    >
      {children}
    </ChatbotContext.Provider>
  )
}

export function useChatbot() {
  return useContext(ChatbotContext)
}
