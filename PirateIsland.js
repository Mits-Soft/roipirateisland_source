"use strict"

// register the application module
b4w.register("PirateIsland_main", function(exports, require) {

// import modules used by the app
var m_app       = require("app");
var m_cfg       = require("config");
var m_data      = require("data");
var m_preloader = require("preloader");
var m_ver       = require("version");
var m_fps       = require("fps");
var m_lght      = require("lights");
var m_ctl       = require("controls");
var m_scs       = require("scenes");
var m_scrn      = require("screenshooter");
var m_cont      = require("container");
var m_const     = require("constraints");
var m_trans     = require("transform");
var m_vec3      = require("vec3");
var m_obj       = require("objects");
var m_phys      = require("physics");
var m_quat      = require("quat");
var m_cam       = require("camera");
var m_util      = require("util");
var m_tsr       = require("tsr");
var m_mat       = require("material");

var _vec2_tmp = new Float32Array(2);
var _vec3_tmp = m_vec3.create();
var _quat_tmp = m_quat.create();

var _character;
var _camera;
var _tomato_thrower;
var _tomato;
var _tomato_count = 0;
var _splashcount = 0;

// detect application mode
var DEBUG = (m_ver.type() == "DEBUG");

var FPS_GAME_CAM_SMOOTH_FACTOR = 0.01;
var FPS_GAME_SENSITIVITY = 110;

// automatically detect assets path
var APP_ASSETS_PATH = m_cfg.get_assets_path("PirateIsland");

/**
 * export the method to initialize the app (called at the bottom of this file)
 */
exports.init = function() {
    m_app.init({
        canvas_container_id: "main_canvas_container",
        callback: init_cb,
        show_fps: DEBUG,
        console_verbose: DEBUG,
        autoresize: true
    });
}

/**
 * callback executed when the app is initialized 
 */
function init_cb(canvas_elem, success) {

    if (!success) {
        console.log("b4w init failure");
        return;
    }

    m_preloader.create_preloader();

    // ignore right-click on the canvas element
    canvas_elem.oncontextmenu = function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    load();
}

/**
 * load the scene data
 */
function load() {
    setup_load_screen();
    m_data.load(APP_ASSETS_PATH + "PirateIsland.json", load_cb, preloader_cb);
}

function setup_load_screen() {
    var bg_div = document.getElementById('main_canvas_container').children[1];
    bg_div.style.backgroundImage = "url('villatuerto_bg.png')";
    // /html/body/div/div[2]
}

/**
 * update the app's preloader
 */
function preloader_cb(percentage) {
    m_preloader.update_preloader(percentage);
}

/**
 * callback executed when the scene data is loaded
 */
function load_cb(data_id, success) {

    if (!success) {
        console.log("b4w load failure");
        return;
    }

    init_system();
    
}

function init_system() {
    _character = m_scs.get_first_character();
    _camera = m_scs.get_active_camera();
    _tomato_thrower = m_scs.get_object_by_name("CubeThrower");
    _tomato = m_scs.get_object_by_name("Tomato");
    config_system();
    init_physics();
    init_camera();
    // m_app.enable_camera_controls();
    setup_keyboard();
    setup_mouse();
    m_fps.enable_fps_controls();
    m_fps.set_cam_smooth_factor(FPS_GAME_CAM_SMOOTH_FACTOR);
    m_fps.set_cam_sensitivity(FPS_GAME_SENSITIVITY);
    m_lght.set_day_time(4.0);
}

function init_camera() {
    m_cam.correct_up(_camera);
}
function config_system() {
    m_cfg.set('max_fps', 45);
    m_cfg.set('max_fps_physics', 500); 
}


function take_picture_cb() {
        m_scrn.shot();
        console.log("Picture taken.");
}

function click() {
    var thrown_obj = m_obj.copy(_tomato, "Tomato." + String(++_tomato_count), false);
    m_scs.append_object(thrown_obj);
    
    // m_phys.append_collision_test(thrown_obj, null, tomato_collision, true);
    m_cam.get_camera_angles(_camera, _vec2_tmp);
    // _vec2_tmp[0] = m_util.rad_to_deg(_vec2_tmp[0]);
    // _vec2_tmp[1] = m_util.rad_to_deg(_vec2_tmp[1]);
    console.log("Camera angles: " + _vec2_tmp);
    var translation = m_trans.get_translation(_tomato_thrower, _vec3_tmp);
    var rotation = m_trans.get_rotation(_tomato_thrower, _quat_tmp);
    // m_quat.identity(_quat_tmp); 
    m_phys.set_transform(thrown_obj, _vec3_tmp, _quat_tmp);
    m_trans.set_rotation_v(thrown_obj, _quat_tmp);
    m_trans.rotate_x_local(thrown_obj, -_vec2_tmp[1]);
    // m_phys.sync_transform(thrown_obj);
    m_phys.apply_velocity(thrown_obj, 0, -50, 0);
    set_object_collision_test(thrown_obj);    
    console.log("Thrower position: " + translation[0] + ", " + translation[1] + ", " + translation[2]);
    console.log("Thrower rotation: " + rotation[0] + ", " + rotation[1] + ", " 
    + rotation[2] + ", " + rotation[3]);
    translation = m_trans.get_translation(_character, _vec3_tmp);
    console.log("Character position: " + translation[0] + ", " + translation[1] + ", " + translation[2]);
    
   
    // translation = m_trans.get_translation(thrown_obj, _vec3_tmp);
    // console.log("Tomato position: " + translation[0] + ", " + translation[1] + ", " + translation[2]);    
    console.log("Click made");
}

function set_object_collision_test(obj) {
    if (m_phys.has_physics(obj)) {
        m_phys.enable_simulation(obj);

        // create sensors to detect collisions
        var sensor_col = m_ctl.create_collision_sensor(obj, "ANY", true);

        m_ctl.create_sensor_manifold(obj, "COLLISION", m_ctl.CT_CONTINUOUS, 
        [sensor_col], function () {return true}, tomato_collision);

    }
}

function tomato_collision(obj, id, pulse) {
    if(pulse==1) {
        var has_collision = m_ctl.get_sensor_value(obj, id, 0);
        if (has_collision) {
            var decal_tsr = m_tsr.create();
            var obj_tsr = m_tsr.create();
            var decal_rot = m_quat.create();
            var payload = m_ctl.get_sensor_payload(obj, id, 0);
            if(payload.coll_obj != null) {
                var splash = m_scs.get_object_by_name("TomatoSplash");
                var decal = m_obj.copy(splash, "TomatoSplash. " + String(++_splashcount), false);
                m_scs.append_object(decal);
                m_tsr.set_trans(payload.coll_pos, decal_tsr);
                m_quat.rotationTo(m_util.AXIS_Z, payload.coll_norm, decal_rot);
                m_trans.set_rotation_v(decal, decal_rot);
                m_tsr.set_quat(decal_rot, decal_tsr);

                if(payload.coll_obj.name == "Bodrio") {
                    disolve_objects([payload.coll_obj, decal]);
                    // m_scs.remove_object(payload.coll_obj);
                    // m_scs.remove_object(decal);
                    console.log("Bodrio killed");
                }
                
                // m_trans.get_tsr(obj, obj_tsr);
                
                // m_tsr.invert(obj_tsr, obj_tsr);
                // m_tsr.multiply(obj_tsr, decal_tsr, decal_tsr);

                m_trans.set_tsr(decal, decal_tsr);
                m_scs.remove_object(obj);
                // console.log("Tomato collided " + payload.coll_obj.name);
            } else if (payload.coll_obj == null) {
                // var splash = m_scs.get_object_by_name("TomatoSplash");
                // var decal = m_obj.copy(splash, "TomatoSplash. " + String(++_splashcount), false);
                // m_scs.append_object(decal);
                // m_tsr.set_trans(payload.coll_pos, decal_tsr);
                // m_quat.rotationTo(m_util.AXIS_Z, payload.coll_norm, decal_rot);
                // m_trans.set_rotation_v(decal, decal_rot);
                // m_tsr.set_quat(decal_rot, decal_tsr);
                // // m_scs.remove_object(obj);
                // m_trans.set_tsr(decal, decal_tsr);
//** TODO: Set a rate to tomatos that collide with no collidable objects */
                console.log("Tomato collided " + payload);
            }
        }
    }
}

function disolve_objects(objects) {
    var cd = 100;
    if(Array.isArray(objects)) {
        for(var i = 0; i < objects.length; i++) {
            
            dissolve(objects[i], cd);
        }
    } else {
        dissolve(objects, cd);
    }
    
}

function dissolve(obj, t) {
    var t0 = t;
    var interval = setInterval(set_alpha, 1);
    function set_alpha() {
        if(t == 0) {
            m_scs.remove_object(obj);
            clearInterval(interval); 
        } else {
            t--;
            var factor = t / t0; 
            m_mat.set_alpha_factor(obj, obj.materials[0].name, factor);
        }
       
    }
}

function init_physics() {
    var _spawners = m_scs.get_all_objects("EMPTY");
    var next_bodrio_number = 0;
    var interval = setInterval(spawn_bodrio, 5000);
    function spawn_bodrio() {
        
        if (next_bodrio_number > 2) {
            next_bodrio_number = 0;

        } else {
            var _bodrio = m_scs.get_object_by_name("Bodrio");
            var next_bodrio = m_obj.copy(_bodrio, "Bodrio." + next_bodrio_number.toString(), false);
            m_trans.get_translation(_spawners[next_bodrio_number], _vec3_tmp);
            m_trans.set_translation(next_bodrio, _vec3_tmp);
            next_bodrio_number++;
        }
        

    }
    m_const.append_stiff_trans_rot(_tomato_thrower, _character, [-1, 0, 1.2]);
    // m_const.append_copy_loc(_tomato_thrower, _character, 'XYZ', false, 1);
}

function setup_keyboard() {
    var key_i = m_ctl.create_keyboard_sensor(m_ctl.KEY_I);    
    m_ctl.create_sensor_manifold(_character, "TAKE_SCREENSHOT", m_ctl.CT_SHOT,
            [key_i], null, take_picture_cb);

}

function setup_mouse() {
    var canvas_elem = m_cont.get_canvas();
    canvas_elem.addEventListener("mousedown", click, false);
}


});

// import the app module and start the app by calling the init method
b4w.require("PirateIsland_main").init();
