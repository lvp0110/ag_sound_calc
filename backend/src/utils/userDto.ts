import { type Company, type User } from "@prisma/client";

export const toCompanyDto = (company: Company) => ({
  id: company.id,
  name: company.name,
  address: company.address,
  ogrn: company.ogrn,
  kpp: company.kpp,
  inn: company.inn,
});

export const toUserDto = (user: User & { company?: Company | null }) => ({
  id: user.id,
  full_name: user.fullName,
  phone: user.phone,
  email: user.email,
  office_address: user.officeAddress,
  role: user.role,
  is_blocked: user.isBlocked,
  company_id: user.companyId,
  company: user.company ? toCompanyDto(user.company) : null,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});
