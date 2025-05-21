declare global {
  namespace Express {
    interface User {
      is_admin: boolean
    }
    interface Request {
      user?: User
    }
  }
}
