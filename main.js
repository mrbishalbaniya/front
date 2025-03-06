document.addEventListener('DOMContentLoaded', () => {
    const socket = io('https://webrtc-backend-w6fw.onrender.com'); // Replace with your backend URL

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const disconnectButton = document.getElementById('disconnectButton');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    const onlineUsersDropdown = document.getElementById('online-users');
    const callButton = document.getElementById('call-button');

    let peerConnection;
    let localStream;
    let isCaller = false;
    let iceCandidateQueue = [];
    let partnerId;
    let username;
    let selectedUser; // Track the selected user for chat or call

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
        onlineUsersDropdown.innerHTML = '<option value="">Select a user to chat or call</option>';
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

    // Handle initiating a video call
    callButton.addEventListener('click', () => {
        if (selectedUser) {
            console.log(`Calling ${selectedUser}`);
            createPeerConnection(selectedUser);
            createOffer(selectedUser);
        } else {
            alert('Please select a user to call.');
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

    // Create peer connection
    function createPeerConnection(partnerId) {
        peerConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' } // Free STUN server
            ]
        });

        // Add local stream to peer connection
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal', { to: partnerId, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };
    }

    // Create and send offer
    function createOffer(partnerId) {
        peerConnection.createOffer()
            .then((offer) => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('signal', { to: partnerId, signal: { type: 'offer', offer: peerConnection.localDescription } });
            })
            .catch((error) => {
                console.error('Error creating offer:', error);
            });
    }

    // Handle signaling messages
    socket.on('signal', (data) => {
        if (!peerConnection) {
            console.error("PeerConnection is not initialized yet.");
            return;
        }

        if (data.signal.type === 'offer') {
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer))
                .then(() => peerConnection.createAnswer())
                .then((answer) => peerConnection.setLocalDescription(answer))
                .then(() => {
                    socket.emit('signal', { to: data.from, signal: { type: 'answer', answer: peerConnection.localDescription } });
                })
                .catch((error) => {
                    console.error('Error handling offer:', error);
                });
        } else if (data.signal.type === 'answer') {
            peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer))
                .catch((error) => {
                    console.error('Error handling answer:', error);
                });
        } else if (data.signal.type === 'candidate') {
            peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate))
                .catch((error) => {
                    console.error('Error adding ICE candidate:', error);
                });
        }
    });
});
