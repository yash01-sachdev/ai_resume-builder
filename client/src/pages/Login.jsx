import { Lock, Mail, User2Icon } from 'lucide-react'
import React from 'react'
import api from '../configs/api'
import { useDispatch } from 'react-redux'
import { login } from '../app/features/authSlice'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'

const Login = () => {

    const dispatch = useDispatch()
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const state = searchParams.get('state') === 'register' ? 'register' : 'login'
    const [isSubmitting, setIsSubmitting] = React.useState(false)

    const [formData, setFormData] = React.useState({
        name: '',
        email: '',
        password: ''
    })

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (isSubmitting) return

        const payload = {
            email: formData.email.trim(),
            password: formData.password
        }

        if (state === 'register') {
            payload.name = formData.name.trim()

            if (!payload.name) {
                toast.error('Please enter your name')
                return
            }
        }

        setIsSubmitting(true)

        try {
            const { data } = await api.post(`/api/users/${state}`, payload)
            localStorage.setItem('token', data.token)
            dispatch(login(data))
            toast.success(data.message)
            navigate('/app', { replace: true })
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const toggleAuthMode = () => {
        setSearchParams({ state: state === 'login' ? 'register' : 'login' })
    }
  return (
    <div className='flex items-center justify-center min-h-screen bg-gray-50'>
      <form onSubmit={handleSubmit} className="sm:w-[350px] w-full text-center border border-gray-300/60 rounded-2xl px-8 bg-white">
                <h1 className="text-gray-900 text-3xl mt-10 font-medium">{state === "login" ? "Login" : "Sign up"}</h1>
                <p className="text-gray-500 text-sm mt-2">Please {state} to continue</p>
                {state !== "login" && (
                    <div className="flex items-center mt-6 w-full bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                        <User2Icon size={16} color='#6B7280'/>
                        <input type="text" name="name" placeholder="Name" className="border-none outline-none ring-0" value={formData.name} onChange={handleChange} required />
                    </div>
                )}
                <div className="flex items-center w-full mt-4 bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                    <Mail size={13} color="#6B7280" />
                    <input type="email" name="email" placeholder="Email id" className="border-none outline-none ring-0" value={formData.email} onChange={handleChange} required />
                </div>
                <div className="flex items-center mt-4 w-full bg-white border border-gray-300/80 h-12 rounded-full overflow-hidden pl-6 gap-2">
                    <Lock size={13} color="#6B7280"/>
                    <input type="password" name="password" placeholder="Password" className="border-none outline-none ring-0" value={formData.password} onChange={handleChange} required />
                </div>
                <div className="mt-4 text-left text-blue-500">
                    <button className="text-sm" type="reset">Forget password?</button>
                </div>
                <button disabled={isSubmitting} type="submit" className="mt-2 w-full h-11 rounded-full text-white bg-blue-500 hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-70">
                    {isSubmitting ? 'Please wait...' : state === "login" ? "Login" : "Sign up"}
                </button>
                <p className="text-gray-400 text-xs mt-3">The backend may take a few seconds to wake up on the first request.</p>
                <p className="text-gray-500 text-sm mt-3 mb-11">{state === "login" ? "Don't have an account?" : "Already have an account?"} <button type="button" onClick={toggleAuthMode} className="text-blue-500 hover:underline cursor-pointer">click here</button></p>
            </form>
    </div>
  )
}

export default Login
