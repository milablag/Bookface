from models.admin_model import AdminModel

def get_admin_profile_image(admin_id):
    image = AdminModel.get_profile_image(admin_id)
    return f"/static/uploads/{image}" if image else '/static/ava.jpg'