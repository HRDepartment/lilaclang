\draw-init
\clear-all

const recordRow (document/create-element :div)
recordRow.className = "vmsg-record-row"

\popup.append-child recordRow

const recordBtn (document/create-element :button)
\recordBtn = .recordBtn
recordBtn.className
recordBtn.add-event-listener "click" (lambda
	\startRecording
)

const audio (new Audio)
audio.autoplay = true

audio.add-event-listener "click" (lambda
	if audio.paused
		if \blobURL
			audio.src = \blobURL
	else
		audio.pause
)

\draw-time
recordRow.append-child



    this.drawInit();
    this.clearAll();

    const recordRow = document.createElement("div");
    recordRow.className = "vmsg-record-row";
    this.popup.appendChild(recordRow);

    const recordBtn = this.recordBtn = document.createElement("button");
    recordBtn.className = "vmsg-button vmsg-record-button";
    recordBtn.textContent = "●";
    recordBtn.addEventListener("click", () => this.startRecording());
    recordRow.appendChild(recordBtn);

    const stopBtn = this.stopBtn = document.createElement("button");
    stopBtn.className = "vmsg-button vmsg-stop-button";
    stopBtn.style.display = "none";
    stopBtn.textContent = "■";
    stopBtn.addEventListener("click", () => this.stopRecording());
    recordRow.appendChild(stopBtn);

    const audio = this.audio = new Audio();
    audio.autoplay = true;

    const timer = this.timer = document.createElement("span");
    timer.className = "vmsg-timer";
    timer.addEventListener("click", () => {
      if (audio.paused) {
        if (this.blobURL) {
          audio.src = this.blobURL;
        }
      } else {
        audio.pause();
      }
    });
    this.drawTime(0);
    recordRow.appendChild(timer);