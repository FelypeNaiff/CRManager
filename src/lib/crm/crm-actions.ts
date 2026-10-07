"use server"

import { requireAuth } from "@/lib/auth/permissions"
import { prisma } from "@/lib/prisma"

export async function getBirthdaysAction(month: number) {
  try {
    const auth = await requireAuth()

    // Prisma doesn't have native EXTRACT(MONTH) easy cross-db, but we can fetch and filter or use native query.
    // For simplicity and since we only need the children:
    const children = await prisma.customerChild.findMany({
      where: {
        customer: { companyId: auth.companyId }
      },
      include: {
        customer: true
      }
    })

    const filtered = children.filter(c => c.birthDate && c.birthDate.getMonth() + 1 === month)
    
    const formatted = filtered.map(c => {
      const today = new Date()
      let age = today.getFullYear() - c.birthDate!.getFullYear()
      const m = today.getMonth() - c.birthDate!.getMonth()
      if (m < 0 || (m === 0 && today.getDate() < c.birthDate!.getDate())) {
        age--
      }

      return {
        id: c.id,
        childName: c.name,
        birthDate: c.birthDate!.toISOString(),
        ageToComplete: age + 1,
        clothingSize: c.clothingSize || "-",
        shoeSize: c.shoeSize || "-",
        parentName: c.customer.name,
        whatsapp: c.customer.phone || ""
      }
    }).sort((a, b) => new Date(a.birthDate).getDate() - new Date(b.birthDate).getDate())

    return { success: true, data: formatted }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getWalletsWithBalanceAction() {
  try {
    const auth = await requireAuth()

    const wallets = await prisma.customerWallet.findMany({
      where: {
        customer: { companyId: auth.companyId },
        balance: { gt: 0 }
      },
      include: {
        customer: true,
        movements: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    let totalCredit = 0
    const list = wallets.map(w => {
      const bal = w.balance ? Number(w.balance) : 0
      totalCredit += bal
      return {
        id: w.id,
        customerId: w.customerId,
        customerName: w.customer.name,
        whatsapp: w.customer.phone || "",
        balance: bal,
        lastMovement: w.movements.length > 0 ? w.movements[0].createdAt.toISOString() : null
      }
    })

    return {
      success: true,
      data: {
        items: list,
        kpis: {
          totalClients: list.length,
          totalCredit
        }
      }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export interface ChildrenFilters {
  minAge?: number;
  maxAge?: number;
  gender?: string;
  clothingSize?: string;
  shoeSize?: string;
}

export async function getChildrenAction(filters: ChildrenFilters = {}) {
  try {
    const auth = await requireAuth()

    const whereClause: any = { customer: { companyId: auth.companyId } }

    if (filters.gender) whereClause.gender = filters.gender
    if (filters.clothingSize) whereClause.clothingSize = { contains: filters.clothingSize, mode: 'insensitive' }
    if (filters.shoeSize) whereClause.shoeSize = { contains: filters.shoeSize, mode: 'insensitive' }

    const children = await prisma.customerChild.findMany({
      where: whereClause,
      include: { customer: true },
      orderBy: { name: 'asc' }
    })

    const today = new Date()

    let filtered = children.map(c => {
      let age = 0
      if (c.birthDate) {
        age = today.getFullYear() - c.birthDate.getFullYear()
        const m = today.getMonth() - c.birthDate.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < c.birthDate.getDate())) {
          age--
        }
      }

      return {
        id: c.id,
        name: c.name,
        gender: c.gender === 'M' ? 'Menino' : (c.gender === 'F' ? 'Menina' : 'Outro'),
        age,
        birthDate: c.birthDate ? c.birthDate.toISOString() : null,
        clothingSize: c.clothingSize || "-",
        shoeSize: c.shoeSize || "-",
        parentName: c.customer.name,
        whatsapp: c.customer.phone || ""
      }
    })

    if (filters.minAge !== undefined) {
      filtered = filtered.filter(c => c.age >= filters.minAge!)
    }
    if (filters.maxAge !== undefined) {
      filtered = filtered.filter(c => c.age <= filters.maxAge!)
    }

    return { success: true, data: filtered }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
