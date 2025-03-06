document.addEventListener('DOMContentLoaded', () => {
    const socket = io('https://webrtc-backend-w6fw.onrender.com'); // Backend URL

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const usernameInput = document.getElementById('username-input');
    const joinButton = document.getElementById('join-button');
    const onlineUsersDropdown = document.getElementById('online-users');
    const callButton = document.getElementById('call-button');

    let peerConnection;
    let localStream;
    let selectedUser = null;
    let username;
    let iceCandidateQueue = [];

    // Get user media
    async function getUserMedia() {
        try {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
        } catch (error) {
            console.error('Error accessing media devices:', error);
            alert('Please allow access to your camera and microphone to use this app.');
        }
    }
    getUserMedia();

    // Join chat
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

    // Update online users list
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

    // Select user for chat/call
    onlineUsersDropdown.addEventListener('change', (event) => {
        selectedUser = event.target.value;
        callButton.disabled = !selectedUser; // Enable call button only if a user is selected
    });

    // Initiate a call
    callButton.addEventListener('click', () => {
        if (selectedUser) {
            console.log(`Calling ${selectedUser}`);
            createPeerConnection();
            createOffer(selectedUser);
        } else {
            alert('Please select a user to call.');
        }
    });

    // Handle chat messages
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

    socket.on('chat_message', (data) => {
        displayMessage(data.from, data.message);
    });

    function displayMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.textContent = `${sender}: ${message}`;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function createPeerConnection() {
        peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('signal', { to: selectedUser, signal: { type: 'candidate', candidate: event.candidate } });
            }
        };
    }
const muteAudioButton = document.createElement("button");
muteAudioButton.innerText = "Mute Audio";
document.body.appendChild(muteAudioButton);

const muteVideoButton = document.createElement("button");
muteVideoButton.innerText = "Mute Video";
document.body.appendChild(muteVideoButton);

muteAudioButton.addEventListener("click", () => {
    localStream.getAudioTracks()[0].enabled = !localStream.getAudioTracks()[0].enabled;
    muteAudioButton.innerText = localStream.getAudioTracks()[0].enabled ? "Mute Audio" : "Unmute Audio";
});

muteVideoButton.addEventListener("click", () => {
    localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
    muteVideoButton.innerText = localStream.getVideoTracks()[0].enabled ? "Mute Video" : "Unmute Video";
});

    const screenShareButton = document.createElement("button");
screenShareButton.innerText = "Share Screen";
document.body.appendChild(screenShareButton);

screenShareButton.addEventListener("click", async () => {
    try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const sender = peerConnection.getSenders().find(s => s.track.kind === "video");
        sender.replaceTrack(screenStream.getVideoTracks()[0]);

        screenStream.getVideoTracks()[0].onended = () => {
            sender.replaceTrack(localStream.getVideoTracks()[0]); // Revert to camera when screen sharing stops
        };
    } catch (error) {
        console.error("Error sharing screen:", error);
    }
});

    chatInput.addEventListener("input", () => {
    socket.emit("typing", { to: selectedUser });
});

socket.on("typing", (data) => {
    const typingIndicator = document.getElementById("typing-indicator");
    typingIndicator.innerText = `${data.from} is typing...`;
    setTimeout(() => typingIndicator.innerText = "", 2000);
});
socket.on("chat_message", (data) => {
    displayMessage(data.from, data.message);
    socket.emit("message_seen", { from: username, to: data.from });
});

socket.on("message_seen", (data) => {
    document.querySelectorAll(".chat-message").forEach(msg => {
        if (msg.dataset.sender === data.from) {
            msg.innerText += " ✅"; // Add a checkmark for seen messages
        }
    });
});
function displayMessage(sender, message) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("chat-message");
    messageElement.dataset.sender = sender;
    messageElement.textContent = `${sender}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
const fileInput = document.getElementById("file-input");
const sendFileButton = document.getElementById("send-file");

sendFileButton.addEventListener("click", () => {
    const file = fileInput.files[0];
    if (file && selectedUser) {
        const reader = new FileReader();
        reader.onload = function () {
            socket.emit("file_message", { to: selectedUser, file: reader.result, fileName: file.name });
        };
        reader.readAsDataURL(file);
    }
});

socket.on("file_message", (data) => {
    const fileLink = document.createElement("a");
    fileLink.href = data.file;
    fileLink.download = data.fileName;
    fileLink.innerText = `Download ${data.fileName}`;
    chatMessages.appendChild(fileLink);
});
const endCallButton = document.getElementById("end-call");

endCallButton.addEventListener("click", () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
        socket.emit("end_call", { to: partnerId });
    }
});

socket.on("end_call", () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
    }
});
const endCallButton = document.getElementById("end-call");

endCallButton.addEventListener("click", () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
        socket.emit("end_call", { to: partnerId });
    }
});

socket.on("end_call", () => {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
        remoteVideo.srcObject = null;
    }
});

    function createOffer(partnerId) {
        peerConnection.createOffer()
            .then(offer => peerConnection.setLocalDescription(offer))
            .then(() => {
                socket.emit('signal', { to: partnerId, signal: { type: 'offer', offer: peerConnection.localDescription } });
            })
            .catch(error => console.error('Error creating offer:', error));
    }

    socket.on('signal', async (data) => {
        if (!peerConnection) {
            createPeerConnection();
        }

        try {
            if (data.signal.type === 'offer') {
                if (peerConnection.signalingState !== 'stable') {
                    console.warn('Offer received in unstable state. Waiting...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.emit('signal', { to: data.from, signal: { type: 'answer', answer: peerConnection.localDescription } });
            } else if (data.signal.type === 'answer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.signal.answer));
            } else if (data.signal.type === 'candidate') {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    });
});
