"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'

export interface Profile {
  id: string
  nome: string
  empresaId?: string
  isAdmin?: boolean
  permissions?: Record<string, boolean>
  [key: string]: any
}

interface ProfileContextType {
  activeProfile: Profile | null
  isLoadingProfile: boolean
  loginProfile: (profile: Profile) => void
  logoutProfile: () => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

const PROFILE_STORAGE_KEY = '@crmanager:activeProfile'

export function ProfileProvider({ children }: { children: React.ReactNãode }) {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROFILE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.id) {
          setActiveProfile(parsed)
        } else {
          localStorage.removeItem(PROFILE_STORAGE_KEY)
        }
      }
    } catch {
      localStorage.removeItem(PROFILE_STORAGE_KEY)
    } finally {
      setIsLoadingProfile(false)
    }
  }, [])

  const loginProfile = useCallback((profile: Profile) => {
    setActiveProfile(profile)
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  }, [])

  const logoutProfile = useCallback(() => {
    setActiveProfile(null)
    localStorage.removeItem(PROFILE_STORAGE_KEY)
    // The HTTP-only session cookie is cleared by the Server Action
    // logoutProfileSession() — called by the layout/header component
  }, [])

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

