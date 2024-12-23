// Display the appropriate login form based on the selected role
function showLoginForm() {
    const teacherRadio = document.getElementById('teacher');
    const studentRadio = document.getElementById('student');
    const submitButton = document.querySelector('.login-form button');
    
    const teacherForm = document.getElementById('teacher-form');
    const studentForm = document.getElementById('student-form');

    // Ensure that only the relevant form is shown
    if (teacherRadio.checked) {
        teacherForm.style.display = 'block';
        studentForm.style.display = 'none';
    } else if (studentRadio.checked) {
        studentForm.style.display = 'block';
        teacherForm.style.display = 'none';
    } else {
        alert('Please select a role to proceed!');
        return;
    }

    // Disable the role radio buttons and the submit button after form is shown
    const radios = document.querySelectorAll('input[name="role"]');
    radios.forEach(radio => radio.disabled = true);
    submitButton.disabled = true;
}

// Hide both forms and re-enable role selection
function cancelForm() {
    const teacherForm = document.getElementById('teacher-form');
    const studentForm = document.getElementById('student-form');
    teacherForm.style.display = 'none';
    studentForm.style.display = 'none';

    const radios = document.querySelectorAll('input[name="role"]');
    const submitButton = document.querySelector('.login-form button');

    // Re-enable the radio buttons and submit button when forms are hidden
    radios.forEach(radio => radio.disabled = false);
    submitButton.disabled = false;
}

// Send OTP to the provided email ID
function getOtp(usernameId, role) {
    const username = document.getElementById(usernameId).value;

    if (!username) {
        alert('Please enter your email ID to receive the OTP.');
        return;
    }

    // Dynamically get the OTP button based on the role
    const otpButton = document.getElementById(`${role}-otp-btn`);
    if (!otpButton) {
        console.error(`${role}-otp-btn not found.`);
        return; // Exit the function if the OTP button isn't found
    }
    otpButton.disabled = true;

    fetch('/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, role })
    })
        .then(response => response.json())  // Ensure the response is parsed as JSON
        .then(data => {
            if (data.message === 'OTP sent successfully') {
                // Enable the OTP input and verify button after OTP is sent
                enableOtpFields(role);
                
                // Use setTimeout to show the alert after DOM is updated
                setTimeout(() => {
                    alert(`OTP has been sent to the email: ${username}`);
                }, 100); // Small delay (100ms) to allow the DOM updates
            } else if (data.error) {
                alert(data.error); // Display the error message
                resetOtpButton(otpButton);  // Re-enable button if there's an error
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error sending OTP. Please try again.');
            resetOtpButton(otpButton);  // Re-enable button on error
        });
}

// Verify OTP for the provided email ID
function verifyOtp(usernameId, role) {
    const username = document.getElementById(usernameId).value;
    const otpInputId = `${usernameId}-otp-input`;
    const enteredOtp = document.getElementById(otpInputId)?.value;

    if (!enteredOtp) {
        alert('Please enter the OTP.');
        return;
    }

    // Disable the verify button to prevent resubmission
    const verifyButton = document.getElementById(`${role}-login-btn`);
    verifyButton.disabled = true;

    fetch('/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: username, otp: enteredOtp })
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            alert('OTP verified successfully! Redirecting...');
            const dashboardUrl = role === 'teacher'
                ? `/teacher-dashboard?email=${encodeURIComponent(username)}`
                : `/student-dashboard?email=${encodeURIComponent(username)}`;
            window.location.href = dashboardUrl;
        } else {
            alert(data.message);
            resetVerifyButton(verifyButton); // Re-enable the button after verification
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('Error verifying OTP. Please try again.');
        resetVerifyButton(verifyButton); // Re-enable the button on error
    });
}

// Enable OTP input and verify button
function enableOtpFields(role) {
    const otpInput = document.getElementById(`${role}-username-otp-input`);
    const verifyButton = document.getElementById(`${role}-login-btn`);

    if (otpInput && verifyButton) {
        otpInput.disabled = false;
        verifyButton.disabled = false;
        otpInput.focus(); // Automatically focus the OTP input field
    }
}

// Reset OTP button state
function resetOtpButton(otpButton) {
    otpButton.disabled = false;
    otpButton.innerHTML = "Get OTP"; // Reset button text
}

// Reset verify button state
function resetVerifyButton(verifyButton) {
    verifyButton.disabled = false;
    verifyButton.innerHTML = "Verify OTP"; // Reset verify button text
}
