const socket = io('https://your-backend-url.onrender.com'); // Replace with your backend URL

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

    // Log signaling state changes
    peerConnection.onsignalingstatechange = () => {
        console.log('Signaling state:', peerConnection.signalingState);
    };

    // Log ICE connection state changes
    peerConnection.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.iceConnectionState);
    };
}

// Create and send offer
function createOffer(partnerId) {
    if (peerConnection.signalingState !== 'stable') {
        console.warn('Cannot create offer: Signaling state is not stable');
        return;
    }

    peerConnection.createOffer()
        .then((offer) => peerConnection.setLocalDescription(offer))
        .then(() => {
            console.log('Sending offer:', peerConnection.localDescription);
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
        // Check if signaling state is stable before handling the offer
        if (peerConnection.signalingState !== 'stable') {
            console.warn('Cannot handle offer: Signaling state is not stable');
            return;
        }

        peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer))
            .then(() => peerConnection.createAnswer())
            .then((answer) => peerConnection.setLocalDescription(answer))
            .then(() => {
                console.log('Sending answer:', peerConnection.localDescription);
                socket.emit('signal', { to: data.from, signal: { type: 'answer', answer: peerConnection.localDescription } });
            })
            .catch((error) => {
                console.error('Error handling offer:', error);
            });
    } else if (data.signal.type === 'answer') {
        // Ensure we're in the right signaling state to handle an answer
        if (peerConnection.signalingState !== 'have-local-offer') {
            console.warn('Cannot handle answer: Signaling state is not have-local-offer');
            return;
        }

        peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer))
            .then(() => {
                console.log('Remote description set, processing queued ICE candidates');
                processIceCandidates(); // Process queued ICE candidates
            })
            .catch((error) => {
                console.error('Error handling answer:', error);
            });
    } else if (data.signal.type === 'candidate') {
        if (!peerConnection.remoteDescription) {
            // Queue ICE candidates if remote description is not set
            console.log('Queueing ICE candidate:', data.signal.candidate);
            iceCandidateQueue.push(data.signal.candidate);
        } else {
            console.log('Adding ICE candidate:', data.signal.candidate);
            peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate))
                .catch((error) => {
                    console.error('Error adding ICE candidate:', error);
                });
        }
    }
});

// Process queued ICE candidates
function processIceCandidates() {
    console.log('Processing queued ICE candidates:', iceCandidateQueue);
    iceCandidateQueue.forEach(candidate => {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error("Error adding queued ICE candidate:", error));
    });
    iceCandidateQueue = []; // Clear the queue
}

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