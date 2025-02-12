const roomInput = document.getElementById("roomInput");
const connectBtn = document.getElementById("connectServer");
const btnLeave = document.getElementById("btnLeave");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
let socket = null;
let pc = null;
let stream = null;

async function connSignalServer() {
  roomInput.disabled = true;
  const constraints = {
    video: {
      width: 640,
      height: 480,
    },
    // audio: {
    //   // 开启回声消除
    //   echoCancellation: true,
    //   // 开启噪声抑制
    //   noiseSuppression: true,
    //   // 开启自动增益控制
    //   autoGainControl: true,
    // },
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    localVideo.srcObject = stream;
    connect();
  } catch (error) {
    console.error("getUserMedia错误原因", error);
  }
}

// 连接信令服务器
function connect() {
  socket = io.connect();

  socket.on("joined", (roomId, id) => {
    console.log("receive joined message!", roomId, id);

    createPeerConnection(roomId);
    // startConnectionStats();

    // 绑定本地流的媒体轨道
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    console.log("媒体轨道已绑定到 PeerConnection");
    connectBtn.disabled = true;
    btnLeave.disabled = false;
  });

  socket.on("otherjoin", async (roomId) => {
    console.log("receive otherjoin message:", roomId);
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: 1,
        offerToReceiveVideo: 1,
      });
      console.log("创建offer", offer);
      pc.setLocalDescription(offer);
      socket.emit("message", roomId, offer);
    } catch (error) {
      console.error("创建 offer 失败:", error);
    }
  });

  socket.on("message", async (roomId, data) => {
    if (data.type === "offer") {
      console.log("收到 offer:", data);
      pc.setRemoteDescription(new RTCSessionDescription(data));
      // create answer
      try {
        const answer = await pc.createAnswer();
        console.log("创建answer", answer);
        pc.setLocalDescription(answer);
        // send answer sdp
        socket.emit("message", roomId, answer);
      } catch (error) {
        console.error("创建 answer 失败:", error);
      }
    } else if (data.type == "answer") {
      console.log("收到 answer:", data);
      pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (data.type === "candidate") {
      console.log("收到 ICE 候选者:", data);
      pc.addIceCandidate(
        new RTCIceCandidate({
          sdpMLineIndex: data.sdpMLineIndex,
          candidate: data.candidate,
        })
      );
    } else {
      console.log("the message is invalid!", data);
    }
  });

  socket.on("full", (roomId, id) => {
    console.log("receive full message", roomId, id);
    socket.disconnect();
    if (pc) {
      pc.close();
      pc = null;
    }
    alert("the room is full!");
  });

  socket.on("leaved", (roomId, id) => {
    console.log("receive leaved message", roomId, id);
    socket.disconnect();
    remoteVideo.srcObject = null;
  });

  socket.on("bye", (roomId, id) => {
    console.log("receive bye message", roomId, id);
    remoteVideo.srcObject = null;
  });

  socket.emit("join", roomInput.value);
}

function createPeerConnection(roomId) {
  console.log("create RTCPeerConnection!");
  if (!pc) {
    pc = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:1.116.74.242:3478",
          username: "zzj",
          credential: "112233",
        },
      ],
    });

    // 监听 ICE 候选者事件
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("发现新的 ICE 候选者:", event.candidate);
        socket.emit("message", roomId, {
          type: "candidate",
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          // id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      } else {
        console.log("所有 ICE 候选者已发送");
      }
    };

    pc.ontrack = (e) => {
      console.log("收到远端流:", e.streams[0]);
      remoteVideo.srcObject = e.streams[0];
    };

    pc.onconnectionstatechange = () => {
      console.log("连接状态:", pc.connectionState);
    };
  } else {
    console.log("The PeerConnection has already been created!");
  }
}

function leave() {
  socket.emit("leave", roomInput.value);
  if (pc) {
    pc.close();
    pc = null;
  }
  roomInput.disabled = false;
  connectBtn.disabled = false;
  btnLeave.disabled = true;
}

// 添加新函数用于收集整体连接统计
function startConnectionStats() {
  if (!pc) return;

  setInterval(async () => {
    const stats = await pc.getStats();
    let mediaInfo = {
      outboundStreams: 0,
      inboundStreams: 0,
    };

    stats.forEach((report) => {
      // 检查发送流
      if (report.type === "outbound-rtp") {
        mediaInfo.outboundStreams++;
      }

      // 检查接收流
      if (report.type === "inbound-rtp") {
        mediaInfo.inboundStreams++;
      }
    });

    console.log("媒体流统计:", {
      发送流数量: mediaInfo.outboundStreams,
      接收流数量: mediaInfo.inboundStreams,
    });
  }, 2000);
}

connectBtn.onclick = connSignalServer;
btnLeave.onclick = leave;
