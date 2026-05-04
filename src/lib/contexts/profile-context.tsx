"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'

export type Role = 'admin' | 'gerente' | 'caixa' | 'vendedor' | 'auxiliar'

export interface Profile {
  id: string
  nome: string
  role: Role
  senhaHash: string // Em produção seria um hash, aqui deixaremos a senha pra validar localmente
}

export const PREDEFINED_PROFILES: Profile[] = [
  { id: 'felype', nome: 'FELYPE', role: 'admin', senhaHash: '1553' },
  { id: 'milena', nome: 'MILENA', role: 'admin', senhaHash: '1553' },
  { id: 'thais', nome: 'THAIS', role: 'gerente', senhaHash: '1234' },
  { id: 'caixa', nome: 'CAIXA', role: 'caixa', senhaHash: '1234' },
  { id: 'vendedor', nome: 'VENDEDOR', role: 'vendedor', senhaHash: '1234' },
  { id: 'auxiliar', nome: 'AUXILIAR', role: 'auxiliar', senhaHash: '1234' },
]

interface ProfileContextType {
  activeProfile: Profile | null
  isLoadingProfile: boolean
  loginProfile: (profileId: string, pin: string) => boolean
  logoutProfile: () => void
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)

  useEffect(() => {
    // Carregar do localStorage ao inicializar
    const stored = localStorage.getItem('@crmanager:activeProfile')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Validar se o perfil existe
        const validProfile = PREDEFINED_PROFILES.find(p => p.id === parsed.id)
        if (validProfile) {
          setActiveProfile(validProfile)
        } else {
          localStorage.removeItem('@crmanager:activeProfile')
        }
      } catch (e) {
        localStorage.removeItem('@crmanager:activeProfile')
      }
    }
    setIsLoadingProfile(false)
  }, [])

  const loginProfile = (profileId: string, pin: string) => {
    const profile = PREDEFINED_PROFILES.find(p => p.id === profileId)
    if (profile && profile.senhaHash === pin) {
      setActiveProfile(profile)
      localStorage.setItem('@crmanager:activeProfile', JSON.stringify(profile))
      return true
    }
    return false
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
