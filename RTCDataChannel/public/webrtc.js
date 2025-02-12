const socket = io.connect(); // 与服务器建立连接
const sendButton = document.getElementById("sendButton");
const messageInput = document.getElementById("messageInput");
const chatWindow = document.getElementById("chatWindow");
const startButton = document.getElementById("startButton");

let peerConnection;
let dataChannel;

const config = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }], // STUN 服务器
};

// 创建连接
function createConnection() {
  peerConnection = new RTCPeerConnection(config);

  // 创建数据通道
  dataChannel = peerConnection.createDataChannel("chat");

  // 处理数据通道事件
  dataChannel.onopen = () => console.log("Data channel is open");

  dataChannel.onmessage = (event) => {
    const message = event.data;
    chatWindow.innerHTML += `<div>Remote: ${message}</div>`;
    chatWindow.scrollTop = chatWindow.scrollHeight; // 滚动到底部
  };

  // 处理 ICE 候选者
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("候选者", event);
      socket.emit("candidate", event.candidate);
    }
  };

  peerConnection
    .createOffer()
    .then((offer) => {
      return peerConnection.setLocalDescription(offer);
    })
    .then(() => {
      socket.emit("offer", peerConnection.localDescription);
    });
}

// 启动连接
startButton.onclick = () => {
  createConnection();
};

// 发送消息
sendButton.onclick = () => {
  const message = messageInput.value;
  dataChannel.send(message);
  chatWindow.innerHTML += `<div>You: ${message}</div>`;
  messageInput.value = ""; // 清空输入框
  chatWindow.scrollTop = chatWindow.scrollHeight; // 滚动到底部
};

// 处理接收的 offer
socket.on("offer", (offer) => {
  console.log("offer", offer);
  if (!peerConnection) return;
  peerConnection
    .setRemoteDescription(new RTCSessionDescription(offer))
    .then(() => {
      // 创建数据通道
      dataChannel = peerConnection.createDataChannel("chat");
      dataChannel.onmessage = (event) => {
        const message = event.data;
        chatWindow.innerHTML += `<div>Remote: ${message}</div>`;
        chatWindow.scrollTop = chatWindow.scrollHeight; // 滚动到底部
      };
      return peerConnection.createAnswer();
    })
    .then((answer) => {
      return peerConnection.setLocalDescription(answer);
    })
    .then(() => {
      socket.emit("answer", peerConnection.localDescription);
    });
});

// 处理接收的 answer
socket.on("answer", (answer) => {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

// 处理接收的 ICE 候选者
socket.on("candidate", (candidate) => {
  console.log("candidate", candidate);
  if (!peerConnection) return;
  peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});
