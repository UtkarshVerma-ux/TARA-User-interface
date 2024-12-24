require('dotenv').config();
const express = require('express');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const sharp = require('sharp');


const app = express();

// MongoDB connection
mongoose.connect("mongodb+srv://kumarayush0926:V9TNMT5743SC9l02@tara.0gmn5.mongodb.net/tara?retryWrites=true&w=majority")
    .then(() => console.log('Database connected successfully'))
    .catch(err => console.error('Database connection error:', err));

// OTP Schema and Model
const otpSchema = new mongoose.Schema({
    email: { type: String, required: true },
    otp: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, index: { expires: 300 } }, // OTP expires after 5 minutes
});

const OTP = mongoose.model('OTP', otpSchema);

// Student Schema and Model
const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    semester: { type: String, required: true },
    courses: [
        { name: { type: String, required: true }, code: { type: String, required: true } }
    ],
    attendance: [
        {
            courseCode: { type: String, required: true },
            records: [
                { date: { type: Date, required: true }, status: { type: String, enum: ['Present', 'Absent'], required: true } }
            ]
        }
    ],
    notices: [{ type: String }]  // Array to hold notices
});

const Student = mongoose.model('Student', studentSchema);

// Teacher Schema and Model
const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    courses: [
        { name: { type: String, required: true }, code: { type: String, required: true }, branch: { type: String, required: true } }
    ],
    attendance: [
        { branch: { type: String, required: true }, courseCode: { type: String, required: true }, date: { type: Date, required: true } }
    ],
    notices: [{ type: String }]  // Array to hold notices
});

const Teacher = mongoose.model('Teacher', teacherSchema);

// Message schema and model (if not already created)
const messageSchema = new mongoose.Schema({
    sender: { type: String, required: true },
    branch: { type: String, required: true }, // Branch to send the message to
    text: { type: String, required: true },
    attachment: { type: String }, // File path to attachment
    date: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Feedback Schema
const feedbackSchema = new mongoose.Schema({
    name: String,
    rollNumber: String,
    email: String,
    feedback: String,
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

// Feedback Model
const Feedback = mongoose.model('Feedback', feedbackSchema)


// Nodemailer transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER,
        pass: process.env.PASSWORD,
    },
});

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        if (!allowedTypes.test(path.extname(file.originalname).toLowerCase()) ||
            !allowedTypes.test(file.mimetype)) {
            return cb(new Error('Only JPEG, JPG, and PNG formats are allowed'));
        }
        cb(null, true);
    },
}).array('photos', 10);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => res.render('index'));

// GET route for displaying the registration form
app.get('/register', (req, res) => {
    const { role } = req.query;

    if (!role || (role !== 'student' && role !== 'teacher')) {
        return res.status(400).render('error', { message: 'Invalid or missing role parameter.' });
    }

    // Render the registration form with the role
    res.render('register', { role });
});

app.get('/reminder', (req, res) => {
    const { role } = req.query;

    // Ensure that a valid role is passed (either 'student' or 'teacher')
    if (!role || (role !== 'student' && role !== 'teacher')) {
        return res.status(400).send('Invalid or missing role parameter.');
    }

    // Sample class data for student
    const sampleClasses = [
        {
            course: 'Internet of Things',
            date: new Date('2024-12-25').toLocaleDateString(),
            time: '10:00 AM',
            classroom: 'Room 101',
        },
        {
            course: 'Machine Learning',
            date: new Date('2024-12-26').toLocaleDateString(),
            time: '2:00 PM',
            classroom: 'Room 202',
        },
        {
            course: 'Internet of Things',
            date: new Date('2024-12-27').toLocaleDateString(),
            time: '9:00 AM',
            classroom: 'Room 303',
        }
    ];

    // Sample class data for teacher (with branch information)
    const sampleTeacherClasses = [
        {
            course: 'Internet of Things',
            date: new Date('2024-12-25').toLocaleDateString(),
            time: '10:00 AM',
            classroom: 'Room 101',
            branch: 'Engineering'
        },
        {
            course: 'Machine Learning',
            date: new Date('2024-12-26').toLocaleDateString(),
            time: '2:00 PM',
            classroom: 'Room 202',
            branch: 'Technology'
        },
        {
            course: 'Internet of Things',
            date: new Date('2024-12-27').toLocaleDateString(),
            time: '9:00 AM',
            classroom: 'Room 303',
            branch: 'Engineering'
        }
    ];

    let upcomingClasses = [];

    // Select classes based on the role (student or teacher)
    if (role === 'student') {
        upcomingClasses = sampleClasses;
    }

    if (role === 'teacher') {
        upcomingClasses = sampleTeacherClasses;
    }

    // Render the reminder page with the appropriate classes for the role
    res.render('reminder', { role, upcomingClasses });
});

// Route for students to view messages
app.get('/view-messages', async (req, res) => {
    const { email } = req.query;

    // Ensure the user is a student
    const student = await Student.findOne({ email });
    if (!student) {
        return res.status(404).render('error', { message: 'Student not found' });
    }

    // Fetch messages for the student based on their branch
    const messages = await Message.find({ branch: student.branch });

    // Render the messages page with the student's messages
    res.render('messages', { messages, role: 'student', email: student.email });
});

// Register route
app.post('/register', async (req, res) => {
    const { role } = req.body;

    // Handle file uploads if the role is student
    if (role === 'student') {
        upload(req, res, async (err) => {
            if (err) {
                console.error('Error uploading photos:', err);
                return res.status(400).render('error', { message: err.message });
            }

            const { name, email, phone, semester } = req.body;
            const studentCourses = req.body.studentCourses || [];

            if (!name || !email || !phone || !semester) {
                return res.status(400).render('error', { message: 'All fields are required for registration' });
            }

            try {
                const student = new Student({
                    name,
                    email,
                    phone,
                    semester,
                    courses: Array.isArray(studentCourses) ? studentCourses.map((course) => ({
                        name: course.name,
                        code: course.code,
                    })) : [],
                    notices: ["Welcome to the student portal! Check your attendance regularly."]
                });

                // Save resized images
                const photoPaths = [];
                for (let i = 0; i < req.files.length; i++) {
                    const photoBuffer = req.files[i].buffer;
                    const photoPath = path.join(__dirname, 'uploads', `${email}-${Date.now()}-${i}.jpeg`);

                    await sharp(photoBuffer)
                        .resize(200, 200)
                        .jpeg({ quality: 90 })
                        .toFile(photoPath);

                    photoPaths.push(photoPath);
                }

                student.photos = photoPaths;
                await student.save();

                res.redirect(`/student-dashboard?email=${email}`);
            } catch (error) {
                console.error('Error registering student:', error);
                res.status(500).render('error', { message: 'Internal server error during registration' });
            }
        });
    }

    // Handle teacher registration
    if (role === 'teacher') {
        const { name, email, phone, teacherCourses } = req.body;

        if (!name || !email || !phone || !teacherCourses) {
            return res.status(400).render('error', { message: 'All fields are required for registration' });
        }

        try {
            const teacher = new Teacher({
                name,
                email,
                phone,
                courses: Array.isArray(teacherCourses) ? teacherCourses.map((course) => ({
                    name: course.name,
                    code: course.code,
                    branch: course.branch,
                })) : [],
                notices: ["Welcome to the teacher portal! Start managing your courses."]
            });

            await teacher.save();
            res.redirect(`/teacher-dashboard?email=${email}`);
        } catch (error) {
            console.error('Error registering teacher:', error);
            res.status(500).render('error', { message: 'Internal server error during registration' });
        }
    }
});




// Route for sending messages from teacher to students
app.post('/send-message', async (req, res) => {
    const { message, attachment, branch } = req.body;
    const { email } = req.query;

    if (!message || !branch) {
        return res.status(400).json({ message: 'Message and branch are required' });
    }

    // Ensure the user is a teacher
    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
        return res.status(404).json({ message: 'Teacher not found' });
    }

    // Save the attachment (if provided)
    let attachmentPath = '';
    if (attachment) {
        const uploadPath = path.join(__dirname, 'uploads', attachment.name);
        attachment.mv(uploadPath, (err) => {
            if (err) return res.status(500).json({ message: 'Failed to upload attachment' });
        });
        attachmentPath = uploadPath;
    }

    // Save the message
    const newMessage = new Message({
        sender: teacher.name,
        branch,
        text: message,
        attachment: attachmentPath
    });

    try {
        await newMessage.save();

        // Optionally, send a notification email to students or update their message board here

        res.status(200).json({ message: 'Message sent successfully' });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Route to handle feedback submission
app.post('/submit-feedback', async (req, res) => {
    const { name, rollNumber, email, feedback } = req.body;

    // Validate required fields
    if (!name || !rollNumber || !email || !feedback) {
        return res.status(400).send('All fields are required!');
    }

    // You can save the feedback data to a database or handle it as needed
    // Example: Save feedback to a database (assuming a Feedback model)
    try {
        const newFeedback = new Feedback({
            name,
            rollNumber,
            email,
            feedback,
            submittedAt: new Date(),
        });

        await newFeedback.save();  // Assuming Mongoose is being used

        // Respond with a success message
        res.send('Thank you for your feedback!');
    } catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).send('Something went wrong. Please try again later.');
    }
});


// Render message page for teachers to send messages
app.get('/teacher/messages', async (req, res) => {
    const { email } = req.query;

    // Ensure the user is a teacher
    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
        return res.status(404).render('error', { message: 'Teacher not found' });
    }

    // Render the message sending page
    res.render('messages', { role: 'teacher', email: teacher.email });
});

app.get('/student-dashboard', async (req, res) => {
    try {
        const student = await Student.findOne({ email: req.query.email });
        if (!student) return res.status(404).render('error', { message: 'Student not found' });

        res.render('student/student-dashboard', { student, role: 'student' , email: req.query.email});
    } catch (error) {
        console.error('Error fetching student dashboard:', error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
});

app.get('/teacher-dashboard', async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ email: req.query.email });
        if (!teacher) return res.status(404).render('error', { message: 'Teacher not found' });

        res.render('teacher/teacher-dashboard', { teacher, role: 'teacher' , email: req.query.email});
    } catch (error) {
        console.error('Error fetching teacher dashboard:', error);
        res.status(500).render('error', { message: 'Internal server error' });
    }
});

// Route to display the student's report page
app.get('/student/report', async (req, res) => {
    const { email } = req.query;

    // Fetch the student information
    const student = await Student.findOne({ email });
    if (!student) {
        return res.status(404).send('Student not found');
    }

    // Render the report page and pass the student's courses
    res.render('student/studentReport', { student , email:email});
});

// Route to handle the attendance report download
app.get('/download-student-report', async (req, res) => {
    const { courseCode, month, year, email } = req.query;

    // Ensure the student exists
    const student = await Student.findOne({ email });
    if (!student) {
        return res.status(404).send('Student not found');
    }

    // Fetch the selected course
    const course = student.courses.find(c => c.code === courseCode);
    if (!course) {
        return res.status(404).send('Course not found');
    }

    // For demonstration, we'll assume the attendance data is available.
    // Typically, you would fetch this data from the database based on the student, course, month, and year.
    const attendanceData = await Attendance.find({
        studentId: student._id,
        courseCode,
        month,
        year
    });

    // If there's no attendance data, send a message
    if (attendanceData.length === 0) {
        return res.status(404).send('No attendance data found for this period');
    }

    // Generate a report file (can be done using a package like 'pdfkit' or 'exceljs')
    const filePath = path.join(__dirname, 'reports', `${student._id}-${courseCode}-${month}-${year}.pdf`);

    // For demonstration, let's pretend we've generated a PDF file
    // Here, you'd actually use a library like 'pdfkit' or 'exceljs' to generate the report.

    // Assuming the file is generated, send the file for download
    res.download(filePath, 'attendance-report.pdf', (err) => {
        if (err) {
            console.error('Error downloading the report:', err);
            return res.status(500).send('Error generating report');
        }
    });
});

// Route for displaying user details (Student or Teacher)
app.get('/user-details', async (req, res) => {
    const { email, role } = req.query;

    if (!email || !role) {
        return res.status(400).render('error', { message: 'Email and role are required' });
    }

    // Check if the role is either 'student' or 'teacher'
    if (role !== 'student' && role !== 'teacher') {
        return res.status(400).render('error', { message: 'Invalid role' });
    }

    let user;

    if (role === 'student') {
        // Fetch student by email
        user = await Student.findOne({ email });
        if (!user) {
            return res.status(404).render('error', { message: 'Student not found' });
        }

        // Render the user details for student
        res.render('user', { role, student: user ,email:email});

    } else if (role === 'teacher') {
        // Fetch teacher by email
        user = await Teacher.findOne({ email });
        if (!user) {
            return res.status(404).render('error', { message: 'Teacher not found' });
        }

        // Render the user details for teacher
        res.render('user', { role, teacher: user , email:email});
    }
});

// Route to display the contact form page
app.get('/contact-us', (req, res) => {
    const { role ,email} = req.query;

    // Render the contact us page, passing the role to the view
    res.render('contact-us', { role ,email:email});
});



// Send OTP to the provided email ID
app.post('/send-otp', async (req, res) => {
    const { email, role } = req.body;

    // Find user based on the role (teacher or student)
    let user;
    if (role === 'teacher') {
        user = await Teacher.findOne({ email });
    } else if (role === 'student') {
        user = await Student.findOne({ email });
    }

    if (!user) {
        return res.status(404).json({ message: 'User not registered' });
    }

    // Generate OTP and send email
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OTP.create({ email, otp });

    // Send OTP email
    await transporter.sendMail({
        from: "darkutkarsh68699@gmail.com",
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
    });

    res.status(200).json({ message: 'OTP sent successfully' });
});

// Verify OTP for the provided email ID
app.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    // Validate OTP
    const otpEntry = await OTP.findOne({ email, otp });
    if (!otpEntry) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Remove the OTP after verification
    await OTP.deleteOne({ email, otp });

    // Check if the user is a teacher or student
    const teacher = await Teacher.findOne({ email });
    if (teacher) {
        return res.status(200).json({ status: 'success', message: 'OTP verified successfully!' });
    }

    const student = await Student.findOne({ email });
    if (student) {
        return res.status(200).json({ status: 'success', message: 'OTP verified successfully!' });
    }

    return res.status(400).json({ message: 'User not found' });
});



app.post('/add-notice', async (req, res) => {
    const { role, email, notice } = req.body;

    // Check if notice and role are provided
    if (!notice || !role || (role !== 'teacher' && role !== 'student')) {
        return res.status(400).json({ message: 'Invalid input' });
    }

    let user;
    if (role === 'teacher') {
        user = await Teacher.findOne({ email });
    } else if (role === 'student') {
        user = await Student.findOne({ email });
    }

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Add the notice to the user's notices array
    user.notices.push(notice);
    await user.save();

    res.status(200).json({ message: 'Notice added successfully!' });
});

// Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
