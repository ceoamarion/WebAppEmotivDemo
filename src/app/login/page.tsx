import AuthForm from '@/components/auth/AuthForm'
import styles from './page.module.css'

export default function LoginPage() {
    return (
        <div className={styles.pageContainer}>
            <div className={styles.formWrapper}>
                <AuthForm />
            </div>
        </div>
    )
}
