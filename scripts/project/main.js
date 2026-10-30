
// Import any other script files here, e.g.:
// import * as myModule from "./mymodule.js";

let oyun1Audio = null;
let oyun1ButtonTimer = null;
let audioRequestId = 0;
let feedbackAudio = null;
let feedbackAudioRequestId = 0;
let oyun2DragState = null;
let oyun2Effects = [];
let oyun2DragEnabled = false;
let oyun2CorrectAnswers = 0;
let oyun1SpeakerEnabled = false;
let oyun1KopekSoundPlayed = false;
let oyun1AnswerLocked = false;
let oyun4DragEnabled = false;
let oyun4DragState = null;
let oyun4InitialPositions = new Map();
let oyun4OccupiedTargets = new Map();
let finalEffectStates = [];

runOnStartup(async runtime =>
{
	// Code to run on the loading screen.
	// Note layouts, objects etc. are not yet available.
	
	runtime.addEventListener("beforeprojectstart", () => OnBeforeProjectStart(runtime));
});

async function OnBeforeProjectStart(runtime)
{
	// Code to run just before 'On start of layout' on
	// the first layout. Loading has finished and initial
	// instances are created and available to use here.
	// pointerdown works with both mouse clicks and touch input.
	runtime.addEventListener("pointerdown", e => HandlePointerDown(runtime, e));
	runtime.addEventListener("pointermove", e => HandleOyun2PointerMove(runtime, e));
	runtime.addEventListener("pointerup", e => HandleOyun2PointerUp(runtime, e));
	runtime.addEventListener("pointermove", e => HandleOyun4PointerMove(runtime, e));
	runtime.addEventListener("pointerup", e => HandleOyun4PointerUp(runtime, e));
	runtime.addEventListener("afteranylayoutstart", () => HandleLayoutStart(runtime));
	runtime.addEventListener("tick", () => Tick(runtime));
}

async function HandleLayoutStart(runtime)
{
	const layoutAudioFiles = {
		"oyun_1": "1.webm",
		"oyun_2": "5.webm",
		"oyun_3": "6.webm",
		"oyun_4": "11.webm",
		"final": "12.webm"
	};
	const currentLayoutName = runtime.layout.name;
	const layoutAudioFile = layoutAudioFiles[currentLayoutName];
	if (currentLayoutName !== "oyun_2")
	{
		oyun2DragState = null;
		oyun2Effects = [];
		oyun2DragEnabled = false;
		oyun2CorrectAnswers = 0;
		StopFeedbackAudio();
	}

	if (currentLayoutName !== "oyun_1")
	{
		oyun1SpeakerEnabled = false;
		oyun1KopekSoundPlayed = false;
		oyun1AnswerLocked = false;
	}

	if (currentLayoutName !== "oyun_4")
	{
		oyun4DragEnabled = false;
		oyun4DragState = null;
	}

	if (currentLayoutName !== "final")
		finalEffectStates = [];

	if (!layoutAudioFile)
	{
		if (oyun1ButtonTimer !== null)
		{
			clearTimeout(oyun1ButtonTimer);
			oyun1ButtonTimer = null;
		}

		StopCurrentAudio();
		return;
	}

	// Use Construct's asset manager so the same code works in preview and export.
	if (currentLayoutName === "oyun_2")
		oyun2DragEnabled = false;

	if (currentLayoutName === "oyun_4")
		HandleOyun4Layout(runtime);
	else if (currentLayoutName === "final")
	{
		HandleFinalLayout(runtime);
		PlayAudioFile(runtime, "12.webm", "final");
	}
	else
		PlayAudioFile(runtime, layoutAudioFile, currentLayoutName);

	if (currentLayoutName === "oyun_1")
	{
		oyun1SpeakerEnabled = false;
		oyun1KopekSoundPlayed = false;
		oyun1AnswerLocked = false;

		const congratulationsSprite = runtime.objects.tebrikler?.getFirstInstance();
		if (congratulationsSprite)
			congratulationsSprite.isVisible = false;

		const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
		if (nextButton)
			nextButton.isVisible = false;
	}

	if (currentLayoutName !== "oyun_1")
	{
		if (currentLayoutName === "oyun_2")
		{
		oyun2CorrectAnswers = 0;
		SetOyun2NextButtonState(runtime, false);
		}
		else if (currentLayoutName === "oyun_3")
		{
			SetupOyun3Layout(runtime);
		}

		return;
	}

	const startButton = runtime.objects.btn_basla?.getFirstInstance();
	const instructionSprite = runtime.objects.nefeskonusmasi?.getFirstInstance();

	// The start button stays hidden and cannot be clicked while the sound starts.
	if (startButton)
		startButton.isVisible = false;

	if (instructionSprite)
		instructionSprite.isVisible = true;

	if (oyun1ButtonTimer !== null)
		clearTimeout(oyun1ButtonTimer);

	// After 5 seconds, reveal and enable the button.
	oyun1ButtonTimer = setTimeout(() =>
	{
		if (runtime.layout.name !== "oyun_1")
			return;

		const button = runtime.objects.btn_basla?.getFirstInstance();
		if (button)
			button.isVisible = true;
	}, 5000);
}

function HandleOyun4Layout(runtime)
{
	SetupOyun4Layout(runtime);
	PlayAudioFile(runtime, "11.webm", "oyun_4");
}

function HandleFinalLayout(runtime)
{
	finalEffectStates = [];

	const family = runtime.objects.final;
	if (!family)
		return;

	for (const instance of family.getAllInstances())
	{
		const [x, y] = instance.getPosition();
		const [width, height] = instance.getSize();

		instance.isVisible = false;
		instance.opacity = 0;

		finalEffectStates.push({
			instance,
			x,
			y,
			width,
			height,
			elapsed: 0,
			duration: 0,
			nextDelay: RandomFinalRange(300, 2400),
			isVisible: false,
		halo: null
		});
	}
}

function RandomFinalRange(min, max)
{
	return min + Math.random() * (max - min);
}

function UpdateFinalEffects(runtime)
{
	if (runtime.layout.name !== "final" || finalEffectStates.length === 0)
		return;

	for (const effect of finalEffectStates)
	{
		if (!effect.isVisible)
		{
			effect.nextDelay -= runtime.dt * 1000;
			if (effect.nextDelay > 0)
				continue;

			effect.isVisible = true;
			effect.elapsed = 0;
			effect.duration = RandomFinalRange(1000, 3000);
			effect.instance.isVisible = true;

		const halo = effect.instance.objectType.createInstance(
			effect.instance.layer.name,
			effect.x,
			effect.y
		);
		halo.setSize(effect.width * 1.3, effect.height * 1.3);
		halo.opacity = 0;
		halo.blendMode = "additive";
		halo.moveAdjacentToInstance(effect.instance, false);
		effect.halo = halo;
			continue;
		}

		effect.elapsed += runtime.dt * 1000;
		const elapsed = effect.elapsed;
		const duration = effect.duration;
		const enterDuration = 240;
		const exitDuration = 300;
		let scale = 1;
		let opacity = 1;

		if (elapsed < enterDuration)
		{
			const progress = elapsed / enterDuration;
			const eased = 1 - Math.pow(1 - progress, 3);
			scale = 0.35 + eased * 0.65;
			opacity = eased;
		}
		else if (elapsed > duration - exitDuration)
		{
			const progress = Math.min((elapsed - (duration - exitDuration)) / exitDuration, 1);
			scale = 1 - progress * 0.35;
			opacity = 1 - progress;
		}

		const haloOpacity = opacity * 0.28;
		effect.instance.setPosition(effect.x, effect.y);
		effect.instance.setSize(effect.width * scale, effect.height * scale);
		effect.instance.opacity = opacity;

		if (effect.halo)
		{
			effect.halo.setPosition(effect.x, effect.y);
			effect.halo.setSize(effect.width * (scale + 0.16), effect.height * (scale + 0.16));
			effect.halo.opacity = haloOpacity;
		}

		if (elapsed >= duration)
		{
			effect.isVisible = false;
			effect.nextDelay = RandomFinalRange(700, 2600);
			effect.instance.isVisible = false;
			effect.instance.opacity = 0;
			effect.instance.setPosition(effect.x, effect.y);
			effect.instance.setSize(effect.width, effect.height);

			if (effect.halo)
			{
				effect.halo.destroy();
				effect.halo = null;
			}
		}
	}
}

function SetupOyun4Layout(runtime)
{
	oyun4DragEnabled = false;
	oyun4DragState = null;
	oyun4InitialPositions = new Map();
	oyun4OccupiedTargets = new Map();

	const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
	if (nextButton)
		nextButton.isVisible = false;

	const family = runtime.objects.oyun4;
	if (!family)
		return;

	for (const instance of family.getAllInstances())
	{
		const [x, y] = instance.getPosition();
		oyun4InitialPositions.set(instance.uid, { x, y });
	}
}

function BeginOyun4Drag(runtime, event)
{
	if (oyun4DragState)
		return;

	const family = runtime.objects.oyun4;
	const draggedInstance = FindFamilyInstanceAtPoint(family, event);
	if (!draggedInstance)
		return;

	const [pointerX, pointerY] = draggedInstance.layer.cssPxToLayer(event.clientX, event.clientY);
	const [startX, startY] = draggedInstance.getPosition();

	// If this object was already placed, free its previous target first.
	for (const [targetUid, occupant] of oyun4OccupiedTargets)
	{
		if (occupant.uid === draggedInstance.uid)
		{
			oyun4OccupiedTargets.delete(targetUid);
			break;
		}
	}

	const initialPosition = oyun4InitialPositions.get(draggedInstance.uid) ?? { x: startX, y: startY };
	oyun4DragState = {
		instance: draggedInstance,
		startX: initialPosition.x,
		startY: initialPosition.y,
		offsetX: startX - pointerX,
		offsetY: startY - pointerY,
		pointerStartX: pointerX,
		pointerStartY: pointerY,
		isDragging: false
	};

	draggedInstance.moveToTop();
}

function PlayOyun4SpriteSound(runtime, event)
{
	const soundMap = {
		araba: "aracKorna.webm",
		cekirge: "cekirge.webm",
		dalga: "Dalga.webm",
		esek: "Esek.webm",
		gemi: "Vapur.webm",
		kus2: "kus.webm",
		ruzgar: "ruzgar.webm",
		yagmur: "yagmur.webm",
		korna: "korna.webm"
	};

	for (const [objectName, soundFile] of Object.entries(soundMap))
	{
		const instance = runtime.objects[objectName]?.getFirstInstance();
		if (!IsPointerOverInstance(instance, event))
			continue;

		const assetExists = runtime.assets.projectFileList.some(asset =>
			asset.name.toLowerCase().endsWith(soundFile.toLowerCase()));
		if (assetExists)
			PlayFeedbackAudio(runtime, soundFile, "oyun_4");

		return;
	}
}

function HandleOyun4PointerMove(runtime, event)
{
	if (runtime.layout.name !== "oyun_4" || !oyun4DragState)
		return;

	const dragState = oyun4DragState;
	const [pointerX, pointerY] = dragState.instance.layer.cssPxToLayer(event.clientX, event.clientY);

	if (!dragState.isDragging)
	{
		const dx = pointerX - dragState.pointerStartX;
		const dy = pointerY - dragState.pointerStartY;
		if (Math.hypot(dx, dy) < 8)
			return;

		dragState.isDragging = true;
	}

	dragState.instance.setPosition(pointerX + dragState.offsetX, pointerY + dragState.offsetY);
}

function HandleOyun4PointerUp(runtime, event)
{
	if (runtime.layout.name !== "oyun_4" || !oyun4DragState)
		return;

	const dragState = oyun4DragState;
	if (!dragState.isDragging)
	{
		oyun4DragState = null;
		return;
	}

	const target = FindAvailableOyun4Target(runtime, event);
	if (target)
	{
		dragState.instance.setPosition(target.x, target.y);
		oyun4OccupiedTargets.set(target.uid, dragState.instance);

		if (oyun4OccupiedTargets.size >= 5)
		{
			const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
			if (nextButton)
				nextButton.isVisible = true;
		}
	}
	else
	{
		dragState.instance.setPosition(dragState.startX, dragState.startY);
	}

	oyun4DragState = null;
}

function FindAvailableOyun4Target(runtime, event)
{
	const family = runtime.objects.yerles;
	if (!family)
		return null;

	for (const target of family.getAllInstances())
	{
		if (oyun4OccupiedTargets.has(target.uid))
			continue;

		const [x, y] = target.layer.cssPxToLayer(event.clientX, event.clientY);
		if (target.containsPoint(x, y))
			return target;
	}

	return null;
}

function HandlePointerDown(runtime, event)
{
	// Handle oyun_2's completed-state next button first so no other
	// layout button can intercept this pointer event.
	if (runtime.layout.name === "oyun_2")
	{
		const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
		if (IsPointerOverRect(nextButton, event))
		{
			runtime.goToLayout("oyun_3");
			return;
		}
	}

	if (runtime.layout.name === "oyun_4")
	{
		const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
		if (IsPointerOverRect(nextButton, event))
		{
			runtime.goToLayout("final");
			return;
		}
	}

	const startButton = runtime.objects.btn_macBasla?.getFirstInstance();
	if (IsPointerOverInstance(startButton, event))
	{
		runtime.goToLayout("oyun_1");
		return;
	}

	const gameStartButton = runtime.objects.btn_basla?.getFirstInstance();
	if (IsPointerOverInstance(gameStartButton, event))
	{
		gameStartButton.isVisible = false;

		const instructionSprite = runtime.objects.nefeskonusmasi?.getFirstInstance();
		if (instructionSprite)
			instructionSprite.isVisible = false;

		const congratulationsSprite = runtime.objects.tebrikler?.getFirstInstance();
		if (congratulationsSprite)
			congratulationsSprite.isVisible = false;

		const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
		if (nextButton)
			nextButton.isVisible = false;

		// Stop 1.webm immediately and start 2.webm.
		PlayAudioFile(runtime, "2.webm", "oyun_1");
		return;
	}

	if (runtime.layout.name === "oyun_3" && HandleOyun3Navigation(runtime, event))
		return;

	if (runtime.layout.name === "oyun_1")
	{
		const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
		if (IsPointerOverInstance(nextButton, event))
		{
			runtime.goToLayout("oyun_2");
			return;
		}

		const speakerButton = runtime.objects.btn_hoparlor?.getFirstInstance();
		if (oyun1SpeakerEnabled && IsPointerOverInstance(speakerButton, event))
		{
			const congratulationsSprite = runtime.objects.tebrikler?.getFirstInstance();
			if (congratulationsSprite)
				congratulationsSprite.isVisible = false;

			oyun1KopekSoundPlayed = true;
			PlayFeedbackAudio(runtime, "kopek.webm", "oyun_1");
			return;
		}

		if (oyun1KopekSoundPlayed && !oyun1AnswerLocked)
		{
			const dog = runtime.objects.kopek?.getFirstInstance();
			if (IsPointerOverInstance(dog, event))
			{
				StartOyun1AnswerFeedback(runtime, 0, "3.webm", true);
				return;
			}

			const bird = runtime.objects.kus?.getFirstInstance();
			const cat = runtime.objects.kedi?.getFirstInstance();
			if (IsPointerOverInstance(bird, event) || IsPointerOverInstance(cat, event))
			{
				StartOyun1AnswerFeedback(runtime, 1, "4.webm", false);
				return;
			}
		}
	}

	if (runtime.layout.name === "oyun_4" && oyun4DragEnabled)
	{
		PlayOyun4SpriteSound(runtime, event);
		BeginOyun4Drag(runtime, event);
	}

	const homeButton = runtime.objects.btn_anasayfa?.getFirstInstance();
	if (IsPointerOverInstance(homeButton, event))
	{
		StopCurrentAudio();
		runtime.goToLayout("giris");
		return;
	}

	if (runtime.layout.name === "oyun_2")
	{
		PlayOyun2SpriteSound(runtime, event);

		if (oyun2DragEnabled)
			BeginOyun2Drag(runtime, event);
	}
}

function PlayOyun2SpriteSound(runtime, event)
{
	if (!oyun2DragEnabled)
		return;

	const soundMap = {
		kus: "kus.webm",
		kopek2: "kopek.webm",
		ruzgar: "ruzgar.webm",
		zil: "zil.webm",
		yagmur: "yagmur.webm",
		korna: "korna.webm",
		kapi: "kapi.webm",
		ari: "ari.webm",
		kurbaga: "kurbaga.webm"
	};

	for (const [objectName, soundFile] of Object.entries(soundMap))
	{
		const instance = runtime.objects[objectName]?.getFirstInstance();
		if (IsPointerOverInstance(instance, event))
		{
			PlayFeedbackAudio(runtime, soundFile, "oyun_2");
			return;
		}
	}
}

function ShowOyun1Congratulations(runtime, frame)
{
	const congratulationsSprite = runtime.objects.tebrikler?.getFirstInstance();
	if (!congratulationsSprite)
		return;

	congratulationsSprite.animationFrame = frame;
	congratulationsSprite.isVisible = true;
}

function StartOyun1AnswerFeedback(runtime, frame, soundFile, isCorrect)
{
	oyun1AnswerLocked = isCorrect;
	ShowOyun1Congratulations(runtime, frame);

	const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
	if (nextButton)
		nextButton.isVisible = false;

	PlayFeedbackAudio(runtime, soundFile, "oyun_1", () =>
	{
		if (runtime.layout.name !== "oyun_1")
			return;

		const button = runtime.objects.btn_ileri?.getFirstInstance();
		if (button)
			button.isVisible = true;
	});
}

function SetupOyun3Layout(runtime)
{
	const gameSprite = runtime.objects.oyun3?.getFirstInstance();
	if (!gameSprite)
		return;

	gameSprite.animationFrame = 0;
}

function HandleOyun3Navigation(runtime, event)
{
	const gameSprite = runtime.objects.oyun3?.getFirstInstance();
	if (!gameSprite)
		return false;

	const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
	if (IsPointerOverInstance(nextButton, event))
	{
		if (gameSprite.animationFrame >= 4)
		{
			runtime.goToLayout("oyun_4");
			return true;
		}

		gameSprite.animationFrame = Math.min(gameSprite.animationFrame + 1, 4);
		return true;
	}

	const previousButton = runtime.objects.btn_geri?.getFirstInstance();
	if (IsPointerOverInstance(previousButton, event))
	{
		gameSprite.animationFrame = Math.max(gameSprite.animationFrame - 1, 0);
		return true;
	}

	return false;
}

function BeginOyun2Drag(runtime, event)
{
	if (oyun2DragState)
		return;

	const canliInstance = FindFamilyInstanceAtPoint(runtime.objects.famCanli, event);
	const cansizInstance = FindFamilyInstanceAtPoint(runtime.objects.famCansiz, event);
	const draggedInstance = canliInstance ?? cansizInstance;

	if (!draggedInstance)
		return;

	const [pointerX, pointerY] = draggedInstance.layer.cssPxToLayer(event.clientX, event.clientY);
	const [startX, startY] = draggedInstance.getPosition();

	oyun2DragState = {
		instance: draggedInstance,
		family: canliInstance ? "canli" : "cansiz",
		startX,
		startY,
		offsetX: startX - pointerX,
		offsetY: startY - pointerY,
		pointerStartX: pointerX,
		pointerStartY: pointerY,
		isDragging: false
	};

	draggedInstance.moveToTop();
}

function HandleOyun2PointerMove(runtime, event)
{
	if (runtime.layout.name !== "oyun_2" || !oyun2DragState)
		return;

	const { instance, offsetX, offsetY } = oyun2DragState;
	const [pointerX, pointerY] = instance.layer.cssPxToLayer(event.clientX, event.clientY);

	if (!oyun2DragState.isDragging)
	{
		const dx = pointerX - oyun2DragState.pointerStartX;
		const dy = pointerY - oyun2DragState.pointerStartY;
		if (Math.hypot(dx, dy) < 8)
			return;

		oyun2DragState.isDragging = true;
	}

	instance.setPosition(pointerX + offsetX, pointerY + offsetY);
}

function HandleOyun2PointerUp(runtime, event)
{
	if (runtime.layout.name !== "oyun_2")
		return;

	// Fallback for systems which deliver the release event more reliably than
	// the initial pointerdown event.
	const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
	if (IsPointerOverRect(nextButton, event))
	{
		runtime.goToLayout("oyun_3");
		return;
	}

	if (!oyun2DragState)
		return;

	const dragState = oyun2DragState;
	if (!dragState.isDragging)
	{
		// A simple tap plays the sprite sound but is not treated as a wrong drop.
		oyun2DragState = null;
		return;
	}

	const targetName = dragState.family === "canli" ? "canliYerles" : "cansizYerles";
	const target = runtime.objects[targetName]?.getFirstInstance();
	const [pointerX, pointerY] = dragState.instance.layer.cssPxToLayer(event.clientX, event.clientY);
	const correctDrop = target && target.isVisible && target.containsPoint(pointerX, pointerY);

	if (correctDrop)
	{
		// Snap the dragged sprite to the origin point of its matching target.
		dragState.instance.setPosition(target.x, target.y);
		PlayFeedbackAudio(runtime, "Olumlu.webm");
		oyun2CorrectAnswers++;

		if (oyun2CorrectAnswers === 9)
			SetOyun2NextButtonState(runtime, true);

		StartCorrectDropEffect(dragState.instance, target.x, target.y);
	}
	else
	{
		PlayFeedbackAudio(runtime, "Olumsuz.webm");
		dragState.instance.setPosition(dragState.startX, dragState.startY);
	}

	oyun2DragState = null;
}

function SetOyun2NextButtonState(runtime, isActive)
{
	const nextButton = runtime.objects.btn_ileri?.getFirstInstance();
	if (!nextButton)
		return;

	// Visibility is also used as the active/inactive state by the pointer handler.
	nextButton.isVisible = isActive;
}

function IsPointerOverRect(instance, event)
{
	if (!instance || !instance.isVisible)
		return false;

	const [x, y] = instance.layer.cssPxToLayer(event.clientX, event.clientY);
	const box = instance.getBoundingBox();
	return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
}

function FindFamilyInstanceAtPoint(family, event)
{
	if (!family)
		return null;

	for (const instance of family.getAllInstances())
	{
		if (!instance.isVisible)
			continue;

		const [x, y] = instance.layer.cssPxToLayer(event.clientX, event.clientY);
		if (instance.containsPoint(x, y))
			return instance;
	}

	return null;
}

function StartCorrectDropEffect(instance, x, y)
{
	const [width, height] = instance.getSize();

	oyun2Effects.push({
		instance,
		x,
		y,
		width,
		height,
		elapsed: 0,
		duration: 700
	});
}

function UpdateOyun2Effects(runtime)
{
	if (runtime.layout.name !== "oyun_2" || oyun2Effects.length === 0)
		return;

	for (let i = oyun2Effects.length - 1; i >= 0; i--)
	{
		const effect = oyun2Effects[i];
		effect.elapsed += runtime.dt * 1000;

		const progress = Math.min(effect.elapsed / effect.duration, 1);
		const scale = Math.max(1 - progress, 0.05);
		const shake = (1 - progress) * 14;
		const shakeX = Math.sin(effect.elapsed * 0.08) * shake;
		const shakeY = Math.cos(effect.elapsed * 0.11) * shake * 0.45;

		effect.instance.setPosition(effect.x + shakeX, effect.y + shakeY);
		effect.instance.setSize(effect.width * scale, effect.height * scale);
		effect.instance.opacity = 1 - progress;

		if (progress >= 1)
		{
			effect.instance.destroy();
			oyun2Effects.splice(i, 1);
		}
	}
}

function StopCurrentAudio()
{
	// Invalidate any audio URL request that is still loading.
	audioRequestId++;

	if (oyun1Audio)
	{
		oyun1Audio.pause();
		oyun1Audio.currentTime = 0;
		oyun1Audio = null;
	}

	StopFeedbackAudio();
}

function StopFeedbackAudio()
{
	feedbackAudioRequestId++;

	if (feedbackAudio)
	{
		feedbackAudio.pause();
		feedbackAudio.currentTime = 0;
		feedbackAudio = null;
	}
}

async function PlayFeedbackAudio(runtime, fileName, expectedLayout = runtime.layout.name, onEnded = null)
{
	const requestId = ++feedbackAudioRequestId;

	if (feedbackAudio)
	{
		feedbackAudio.pause();
		feedbackAudio.currentTime = 0;
		feedbackAudio = null;
	}

	const audioUrl = await runtime.assets.getMediaFileUrl(fileName);
	if (requestId !== feedbackAudioRequestId || runtime.layout.name !== expectedLayout)
		return;

	feedbackAudio = new Audio(audioUrl);
	if (onEnded)
		feedbackAudio.addEventListener("ended", onEnded, { once: true });

	feedbackAudio.play().catch(error =>
		console.warn(`${fileName} otomatik başlatılamadı:`, error));
}

async function PlayAudioFile(runtime, fileName, expectedLayout)
{
	const requestId = ++audioRequestId;

	if (oyun1Audio)
	{
		oyun1Audio.pause();
		oyun1Audio.currentTime = 0;
		oyun1Audio = null;
	}

	const audioUrl = await runtime.assets.getMediaFileUrl(fileName);
	if (requestId !== audioRequestId || runtime.layout.name !== expectedLayout)
		return;

	oyun1Audio = new Audio(audioUrl);
	if (expectedLayout === "oyun_2" && fileName === "5.webm")
	{
		oyun1Audio.addEventListener("ended", () =>
		{
			if (requestId === audioRequestId && runtime.layout.name === "oyun_2")
				oyun2DragEnabled = true;
		});
	}
	else if (expectedLayout === "oyun_1" && fileName === "2.webm")
	{
		oyun1Audio.addEventListener("ended", () =>
		{
			if (requestId === audioRequestId && runtime.layout.name === "oyun_1")
				oyun1SpeakerEnabled = true;
		});
	}
	else if (expectedLayout === "oyun_4" && fileName === "11.webm")
	{
		oyun1Audio.addEventListener("ended", () =>
		{
			if (requestId === audioRequestId && runtime.layout.name === "oyun_4")
				oyun4DragEnabled = true;
		});
	}

	oyun1Audio.play().catch(error =>
		console.warn(`${fileName} otomatik başlatılamadı:`, error));
}

function IsPointerOverInstance(instance, event)
{
	if (!instance || !instance.isVisible)
		return false;

	// Convert browser/client coordinates to the layer's layout coordinates.
	const [x, y] = instance.layer.cssPxToLayer(event.clientX, event.clientY);
	return instance.containsPoint(x, y);
}

function Tick(runtime)
{
	// Code to run every tick
	UpdateOyun2Effects(runtime);
	UpdateFinalEffects(runtime);
}
