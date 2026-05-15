"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface Profile {
  id: string
  nome: string
  empresaId?: string
  [key: string]: any
}

interface ProfileContextType {
  activeProfile: Profile | null
  isLoadingProfile: boolean
  loginProfile: (profile: Profile) => void
  logoutProfile: () => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('@crmanager:activeProfile')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed && parsed.id) {
          setActiveProfile(parsed)
        } else {
          localStorage.removeItem('@crmanager:activeProfile')
        }
      } catch (e) {
        localStorage.removeItem('@crmanager:activeProfile')
      }
    }
    setIsLoadingProfile(false)
  }, [])

  const loginProfile = (profile: Profile) => {
    setActiveProfile(profile)
    localStorage.setItem('@crmanager:activeProfile', JSON.stringify(profile))
  }

  const logoutProfile = () => {
    setActiveProfile(null)
    localStorage.removeItem('@crmanager:activeProfile')
  }

  return (
    <ProfileContext.Provider value={{ activeProfile, isLoadingProfile, loginProfile, logoutProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
