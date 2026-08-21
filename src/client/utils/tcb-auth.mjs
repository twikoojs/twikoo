const signInAnonymously = (auth) => auth.signInAnonymously()

const signInWithCustomTicket = (auth, ticket) => {
  auth.setCustomSignFunc(() => Promise.resolve(ticket))
  return auth.signInWithCustomTicket()
}

const isCustomUser = (user) => Boolean(
  user && (
    user.loginType === 'CUSTOM' ||
    (Array.isArray(user.providers) &&
      user.providers.some((provider) => provider && provider.id === 'custom'))
  )
)

const hasCustomLogin = async (auth) => isCustomUser(await auth.getCurrentUser())

export {
  signInAnonymously,
  signInWithCustomTicket,
  isCustomUser,
  hasCustomLogin
}
