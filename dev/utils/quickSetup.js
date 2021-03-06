// quickSetup.js

import { GL, BatchDotsPlane, BatchAxis, CameraPerspective, OrbitalControl } from '../../src/alfrid'
import Scheduler from 'scheduling'
import dat from 'dat-gui'
/*
export default (mRender, mCallback, mResize) => {

}

*/

const quickSetup = (mRender, mResize) => new Promise((resolve, reject) => {
  // create canvas
  const canvas = document.createElement('canvas')
  document.body.appendChild(canvas)

  // INIT GL
  GL.init(canvas, { useWebgl2: true })

  // Camera
  const camera = new CameraPerspective()
  camera.setPerspective(Math.PI / 4, window.innerWidth / window.innerHeight, 0.1, 100)

  // Camera control
  const orbControl = new OrbitalControl(camera, window, 15)
  orbControl.rx.value = orbControl.ry.value = 0.3
  orbControl.radius.value = 5

  // Views
  const batchDots = new BatchDotsPlane()
  const batchAxis = new BatchAxis()

  // render loop
  function loop () {
    GL.clear(0, 0, 0, 0)
    GL.setMatrices(camera)
    batchDots.draw()
    batchAxis.draw()

    if (mRender) {
      mRender()
    }
  }
  Scheduler.addEF(loop)

  //	resizing
  window.addEventListener('resize', resize)
  function resize () {
    GL.setSize(window.innerWidth, window.innerHeight)
    camera.setPerspective(Math.PI / 4, GL.aspectRatio, 0.1, 100)

    if (mResize) {
      mResize()
    }
  }
  resize()

  const o = {
    camera,
    orbControl
  }

  window.gui = new dat.GUI({ width: 300 })

  resolve(o)
})

export default quickSetup
