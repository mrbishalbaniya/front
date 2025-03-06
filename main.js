const socket = io('https://webrtc-backend-w6fw.onrender.com'); // Replace with your backend URL

const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const disconnectButton = document.getElementById('disconnectButton');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

let peerConnection;
let localStream;
let isCaller = false; // Track if this peer is the caller
let iceCandidateQueue = []; // Queue for ICE candidates
let partnerId; // Track the partner's ID

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
        localVideo.srcObject = stream;
        localStream = stream;

        // Handle pairing after localStream is available
        socket.on('paired', (id) => {
            console.log('Paired with:', id);
            partnerId = id;
            createPeerConnection(partnerId);

            // Only the caller creates an offer
            if (!isCaller) {
                isCaller = true;
                createOffer(partnerId);
            }
        });
    })
    .catch((error) => {
        console.error('Error accessing media devices:', error);
        alert('Please allow access to your camera and microphone to use this app.');
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

// Handle chat messages
sendButton.addEventListener('click', () => {
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('chat_message', { to: partnerId, message });
        displayMessage('You', message);
        chatInput.value = '';
    }
});

socket.on('chat_message', (data) => {
    displayMessage('Partner', data.message);
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