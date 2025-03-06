document.addEventListener('DOMContentLoaded', () => {
    const socket = io('https://your-backend-url.onrender.com'); // Replace with your backend URL

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const disconnectButton = document.getElementById('disconnectButton');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    const onlineUsersDropdown = document.getElementById('online-users');

    let peerConnection;
    let localStream;
    let isCaller = false;
    let iceCandidateQueue = [];
    let partnerId;
    let username;
    let selectedUser; // Track the selected user for chat

    // Get user media
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
            localVideo.srcObject = stream;
            localStream = stream;
        })
        .catch((error) => {
            console.error('Error accessing media devices:', error);
            alert('Please allow access to your camera and microphone to use this app.');
        });

    // Handle joining the chat
    joinButton.addEventListener('click', () => {
        username = usernameInput.value.trim();
        if (username) {
            socket.emit('join', username);
            usernameInput.disabled = true;
            joinButton.disabled = true;
        } else {
            alert('Please enter a username.');
        }
    });

    // Handle online users list
    socket.on('online_users', (users) => {
        onlineUsersDropdown.innerHTML = '<option value="">Select a user to chat</option>';
        users.forEach((user) => {
            if (user !== username) {
                const option = document.createElement('option');
                option.value = user;
                option.textContent = user;
                onlineUsersDropdown.appendChild(option);
            }
        });
    });

    // Handle user selection
    onlineUsersDropdown.addEventListener('change', (event) => {
        selectedUser = event.target.value;
        if (selectedUser) {
            console.log(`Selected user: ${selectedUser}`);
        }
    });

    // Handle sending chat messages
    sendButton.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message && selectedUser) {
            socket.emit('chat_message', { to: selectedUser, message });
            displayMessage('You', message);
            chatInput.value = '';
        } else {
            alert('Please select a user to chat with.');
        }
    });

    // Handle receiving chat messages
    socket.on('chat_message', (data) => {
        displayMessage(data.from, data.message);
    });

    // Display a message in the chat UI
    function displayMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${sender}: ${message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Handle disconnect
    disconnectButton.addEventListener('click', () => {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        remoteVideo.srcObject = null;
        socket.emit('user_disconnect');
    });
});
