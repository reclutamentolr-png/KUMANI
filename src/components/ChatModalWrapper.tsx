'use client'

import { useState, useEffect } from 'react'
import ChatModal from '@/components/ChatModal'

export default function ChatModalWrapper({ userId }: { userId: string }) {
  const [chatOpen, setChatOpen] = useState(false)
  const [selectedListing, setSelectedListing] = useState<any>(null)
  const [receiverId, setReceiverId] = useState<string>('')
  const [otherName, setOtherName] = useState<string>('')

  useEffect(() => {
    const handleOpenChat = (event: CustomEvent) => {
      setSelectedListing(event.detail.listing)
      setReceiverId(event.detail.receiverId)
      setOtherName(event.detail.otherName ?? '')
      setChatOpen(true)
    }

    window.addEventListener('openChat', handleOpenChat as EventListener)
    return () => window.removeEventListener('openChat', handleOpenChat as EventListener)
  }, [])

  if (!chatOpen || !selectedListing) return null

  return (
    <ChatModal
      isOpen={chatOpen}
      onClose={() => setChatOpen(false)}
      listing={selectedListing}
      currentUserId={userId}
      receiverId={receiverId}
      otherName={otherName}
    />
  )
}