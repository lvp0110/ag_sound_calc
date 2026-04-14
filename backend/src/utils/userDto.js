export const toUserDto = (user) => ({
  id: user.id,
  full_name: user.fullName,
  phone: user.phone,
  email: user.email,
  office_address: user.officeAddress,
  created_at: user.createdAt,
  updated_at: user.updatedAt,
});
