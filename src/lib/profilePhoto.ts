// Foto del profilo (cartella pubblica profile-photos): indirizzo da mostrare
export const profilePhotoUrl = (path: unknown) =>
  typeof path === 'string' && path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/profile-photos/${path}` : null
