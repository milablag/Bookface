document.addEventListener('DOMContentLoaded', function() {
    function navigateTo(url, event = null) {
        if (event) event.preventDefault();
        document.body.classList.add('fade-out');
        setTimeout(() => {
            window.location.href = url;
        }, 300);
    }

    document.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.href && this.href.startsWith(window.location.origin)) {
                navigateTo(this.href, e);
            }
        });
    });

    function validateField(fieldId, rules) {
        const field = document.getElementById(fieldId);
        const value = field.value;
        const hintElement = document.getElementById(fieldId + '-hint');

        let isValid = true;
        let hintHTML = '';

        if (rules.minLength && value.length < rules.minLength) {
            isValid = false;
            hintHTML += `<div style="color: #c62828;">• Минимум ${rules.minLength} символов</div>`;
        } else if (rules.minLength) {
            hintHTML += `<div style="color: #2e7d32;">• Минимум ${rules.minLength} символов</div>`;
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            isValid = false;
            hintHTML += `<div style="color: #c62828;">• Максимум ${rules.maxLength} символов</div>`;
        } else if (rules.maxLength) {
            hintHTML += `<div style="color: #2e7d32;">• Максимум ${rules.maxLength} символов</div>`;
        }

        if (rules.pattern && !rules.pattern.test(value)) {
            isValid = false;
            hintHTML += `<div style="color: #c62828;">• Только буквы, цифры и подчеркивание (_)</div>`;
        } else if (rules.pattern) {
            hintHTML += `<div style="color: #2e7d32;">• Только буквы, цифры и подчеркивание (_)</div>`;
        }

        if (rules.requireNumber && !/\d/.test(value)) {
            isValid = false;
            hintHTML += `<div style="color: #c62828;">• Хотя бы одна цифра</div>`;
        } else if (rules.requireNumber) {
            hintHTML += `<div style="color: #2e7d32;">• Хотя бы одна цифра</div>`;
        }

        if (rules.requireUpper && !/[A-ZА-Я]/.test(value)) {
            isValid = false;
            hintHTML += `<div style="color: #c62828;">• Хотя бы одна заглавная буква</div>`;
        } else if (rules.requireUpper) {
            hintHTML += `<div style="color: #2e7d32;">• Хотя бы одна заглавная буква</div>`;
        }

        field.classList.toggle('invalid', !isValid);
        field.classList.toggle('valid', isValid);

        if (hintHTML) {
            hintElement.innerHTML = hintHTML;
        }

        return isValid;
    }

    document.querySelectorAll('input').forEach(input => {
        const hint = input.nextElementSibling;
        if (hint && hint.classList.contains('hint')) {
            input.addEventListener('focus', () => {
                hint.classList.add('active');
            });
            input.addEventListener('blur', () => {
                hint.classList.remove('active');
            });
        }
    });

    function validatePasswordMatch() {
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const confirmField = document.getElementById('confirm-password');
        const hintElement = document.getElementById('confirm-password-hint');

        const isValid = password && confirmPassword && password === confirmPassword;

        confirmField.classList.toggle('invalid', !isValid);
        confirmField.classList.toggle('valid', isValid);

        hintElement.innerHTML = isValid ?
            '<div style="color: #2e7d32;">• Пароли совпадают</div>' :
            '<div style="color: #c62828;">• Пароли не совпадают</div>';

        return isValid;
    }

    const validationRules = {
        'username': {
            minLength: 3,
            maxLength: 20,
            pattern: /^[a-zA-Z0-9_]+$/
        },
        'email': {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        },
        'password': {
            minLength: 8,
            requireNumber: true,
            requireUpper: true
        }
    };

    document.getElementById('username').addEventListener('input', function() {
        validateField('username', validationRules['username']);
    });

    document.getElementById('email').addEventListener('input', function() {
        validateField('email', validationRules['email']);
    });

    document.getElementById('password').addEventListener('input', function() {
        validateField('password', validationRules['password']);
        validatePasswordMatch();
    });

    document.getElementById('confirm-password').addEventListener('input', function() {
        validatePasswordMatch();
    });

    document.getElementById('registerForm').addEventListener('submit', function(e) {
        const isUsernameValid = validateField('username', validationRules['username']);
        const isEmailValid = validateField('email', validationRules['email']);
        const isPasswordValid = validateField('password', validationRules['password']);
        const isConfirmValid = validatePasswordMatch();

        if (!isUsernameValid || !isEmailValid || !isPasswordValid || !isConfirmValid) {
            e.preventDefault();
            return;
        }

        document.body.classList.add('fade-out');
    });
});